try:
    import urllib3.contrib.pyopenssl
    urllib3.contrib.pyopenssl.inject_into_urllib3()
except ImportError:
    pass

import argparse
import logging
import logging.config
import requests
import os
from time import sleep, mktime
from urlparse import urljoin

from datetime import datetime
from dateutil.tz import tzlocal
from subprocess import check_output
from couchdb import Database, Session
from time import time
import iso8601
from .design import endDate_view, startDate_view
from .utils import do_until_success, generate_request_id
from yaml import load
from systemd_msgs_ids import (
    DATA_BRIDGE_RE_PLANNING,
    DATA_BRIDGE_PLANNING,
    DATA_BRIDGE_PLANNING_PROCESS
)

logger = logging.getLogger(__name__)


class AuctionsDataBridge(object):

    """AuctionsDataBridge"""

    def __init__(self, config):
        super(AuctionsDataBridge, self).__init__()
        self.config = config

        self.tenders_url = urljoin(
            self.config_get('tenders_api_server'),
            '/api/{}/tenders'.format(
                self.config_get('tenders_api_version')
            )
        )
        self.tz = tzlocal()
        self.couch_url = urljoin(
            self.config_get('couch_url'),
            self.config_get('auctions_db')
        )
        self.db = Database(self.couch_url,
                           session=Session(retry_delays=range(10)))
        self.url = self.tenders_url

    def config_get(self, name):
        return self.config.get('main').get(name)

    def tender_url(self, tender_id):
        return urljoin(self.tenders_url, 'tenders/{}/auction'.format(tender_id))

    def get_teders_list(self, re_planning=False):
        while True:
            params = {'offset': self.offset,
                      'opt_fields': 'status,auctionPeriod',
                      'mode': '_all_'}
            request_id = generate_request_id(prefix=b'data-bridge-req-')
            logger.debug('Start request to {}, params: {}'.format(
                self.url, params),
                extra={"JOURNAL_REQUEST_ID": request_id})

            response = requests.get(self.url, params=params,
                                    headers={'content-type': 'application/json',
                                             'X-Client-Request-ID': request_id})

            logger.debug('Request response: {}'.format(response.status_code))
            if response.ok:
                response_json = response.json()
                if len(response_json['data']) == 0:
                    logger.info("Change offset date to {}".format(response_json['next_page']['offset']),
                                extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                    self.offset = response_json['next_page']['offset']
                    break
                for item in response_json['data']:
                    if 'auctionPeriod' in item \
                            and 'startDate' in item['auctionPeriod'] \
                            and 'endDate' not in item['auctionPeriod'] \
                            and item['status'] == "active.auction":

                        start_date = iso8601.parse_date(item['auctionPeriod']['startDate'])
                        start_date = start_date.astimezone(self.tz)
                        auctions_start_in_date = startDate_view(
                            self.db,
                            key=(mktime(start_date.timetuple()) + start_date.microsecond / 1E6) * 1000
                        )
                        if datetime.now(self.tz) > start_date:
                            logger.info("Tender {} start date in past. Skip it for planning".format(item['id']),
                                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                            continue
                        if re_planning and item['id'] in self.tenders_ids_list:
                            logger.info("Tender {} already planned while replanning".format(item['id']),
                                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                            continue
                        elif not re_planning and [row.id for row in auctions_start_in_date.rows if row.id == item['id']]:
                            logger.info("Tender {} already planned on same date".format(item['id']),
                                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                            continue
                        yield item

                    if item['status'] == "cancelled":
                        future_auctions = endDate_view(
                            self.db, startkey=time() * 1000
                        )
                        if item["id"] in [i.id for i in future_auctions]:
                            logger.info("Tender {} canceled".format(item["id"]),
                                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                            auction_document = self.db[item["id"]]
                            auction_document["current_stage"] = -100
                            auction_document["endDate"] = datetime.now(self.tz).isoformat()
                            self.db.save(auction_document)
                            logger.info("Change auction {} status to 'canceled'".format(item["id"]),
                                        extra={"JOURNAL_REQUEST_ID": request_id,
                                               'MESSAGE_ID': DATA_BRIDGE_PLANNING})

                logger.info(
                    "Change offset date to {}".format(response_json['next_page']['offset']),
                    extra={"JOURNAL_REQUEST_ID": request_id,
                           'MESSAGE_ID': DATA_BRIDGE_PLANNING}
                )
                self.offset = response_json['next_page']['offset']
            else:
                sleep(10)

    def start_auction_worker(self, tender_item):
        result = do_until_success(
            check_output,
            args=([self.config_get('auction_worker'),
                   'planning', str(tender_item['id']),
                   self.config_get('auction_worker_config')],),
        )
        logger.info("Auction planning command result: {}".format(result),
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING_PROCESS})

    def planning_with_couch(self):
        logger.info('Start Auctions Bridge with feed to couchdb',
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
        logger.info('Start data sync...',
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
        self.planned_tenders = {}
        self.last_seq_id = 0
        while True:
            do_until_success(self.handle_continuous_feed)

    def handle_continuous_feed(self):
        change = self.db.changes(feed='continuous', filter="auctions/by_startDate",
                                 since=self.last_seq_id, include_docs=True)
        for tender_item in change:
            if 'id' in tender_item:
                start_date = tender_item['doc']['stages'][0]['start']
                if tender_item['doc'].get("current_stage", "") == -100:
                    continue

                if tender_item['doc'].get("mode", "") == "test":
                    logger.info('Sciped test auction {}'.format(tender_item['id']),
                                extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                    continue

                if tender_item['id'] in self.planned_tenders and \
                        self.planned_tenders[tender_item['id']] == start_date:
                    logger.debug('Tender {} filtered'.format(tender_item['id']))
                    continue
                logger.info('Tender {} selected for planning'.format(tender_item['id']),
                            extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
                self.start_auction_worker(tender_item)
                self.planned_tenders[tender_item['id']] = start_date
            elif 'last_seq' in tender_item:
                self.last_seq_id = tender_item['last_seq']

        logger.info('Resume data sync...',
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})

    def run(self):
        logger.info('Start Auctions Bridge',
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
        self.offset = ''
        logger.info('Start data sync...',
                    extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
        while True:
            for tender_item in self.get_teders_list():
                logger.debug('Tender {} selected for planning'.format(tender_item))
                self.start_auction_worker(tender_item)
                sleep(2)
            logger.info('Sleep...',
                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})
            sleep(100)
            logger.info('Resume data sync...',
                        extra={'MESSAGE_ID': DATA_BRIDGE_PLANNING})

    def run_re_planning(self):
        self.re_planning = True
        self.tenders_ids_list = []
        self.offset = ''
        logger.info('Start Auctions Bridge for re-planning...',
                    extra={'MESSAGE_ID': DATA_BRIDGE_RE_PLANNING})
        for tender_item in self.get_teders_list(re_planning=True):
            logger.debug('Tender {} selected for re-planning'.format(tender_item))
            self.start_auction_worker(tender_item)
            self.tenders_ids_list.append(tender_item['id'])
            sleep(1)
        logger.info("Re-planning auctions finished",
                    extra={'MESSAGE_ID': DATA_BRIDGE_RE_PLANNING})


def main():
    parser = argparse.ArgumentParser(description='---- Auctions Bridge ----')
    parser.add_argument('config', type=str, help='Path to configuration file')
    parser.add_argument(
        '--re-planning', action='store_true', default=False,
        help='Not ignore auctions which already scheduled')
    parser.add_argument(
        '--planning-with-couch', action='store_true', default=False,
        help='Use couchdb for tenders feed')
    params = parser.parse_args()
    if os.path.isfile(params.config):
        with open(params.config) as config_file_obj:
            config = load(config_file_obj.read())
        logging.config.dictConfig(config)
        if params.planning_with_couch:
            AuctionsDataBridge(config).planning_with_couch()
        elif params.re_planning:
            AuctionsDataBridge(config).run_re_planning()
        else:
            AuctionsDataBridge(config).run()


##############################################################

if __name__ == "__main__":
    main()
