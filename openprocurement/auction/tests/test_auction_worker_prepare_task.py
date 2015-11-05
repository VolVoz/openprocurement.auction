# -*- coding: utf-8 -*-
import unittest
from openprocurement.auction.auction_worker import Auction
import sys
import os
import datetime
from dateutil.tz import tzlocal
from ConfigParser import SafeConfigParser
from mock import patch
import subprocess
from subprocess import call


class TestPrepareTasks(unittest.TestCase):

    def setUp(self):
        self.worker_defaults = {
            "TENDERS_API_URL": "https://api-sandbox.openprocurement.org/",
            "TENDERS_API_VERSION": "0.8",
            "COUCH_DATABASE": "http://admin:zaq1xsw2@0.0.0.0:9000/auctions"
        }
        self.auction = Auction(
            "test_id",
            worker_defaults=self.worker_defaults
        )
        self.auction.generate_request_id()
        self.test_argsv = ["/usr/bin/echo", "test"]
        self.parser = SafeConfigParser()
        self.time = datetime.datetime.now(
            tzlocal()) + datetime.timedelta(minutes=30)
        with patch.object(sys, 'argv', self.test_argsv):
            self.auction.prepare_tasks("tenderID", self.time)
        self.home_dir = os.path.expanduser('~')

    def test_start_time(self):
        self.parser.read(
            os.path.join(self.home_dir, '.config/systemd/user/auction_test_id.timer'))
        start_time = self.parser.get('Timer', 'OnCalendar')
        self.assertEqual(
            (self.time - datetime.timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"), start_time)

    def test_put_path(self):
        self.parser.read(
            os.path.join(self.home_dir, '.config/systemd/user/auction_test_id.service'))
        write_cmd = self.parser.get('Service', 'ExecStart')
        self.assertEqual(" ".join((self.test_argsv[0], "run",)), write_cmd)

    def tearDown(self):
        FNULL = open(os.devnull, 'w')
        call(
            ['/usr/bin/systemctl', '--user', 'disable', 'auction_test_id.timer'],
            stdout=FNULL, stderr=subprocess.STDOUT)
        os.remove(
            os.path.join(self.home_dir, '.config/systemd/user/auction_test_id.timer'))
        os.remove(
            os.path.join(self.home_dir, '.config/systemd/user/auction_test_id.service'))
        call(
            ['/usr/bin/systemctl', '--user', 'daemon-reload'],
            stdout=FNULL, stderr=subprocess.STDOUT)
        FNULL.close()