# -*- coding: utf-8 -*-
import unittest
from mock import MagicMock, Mock
from openprocurement.auction.auctions_server import auctions_server
import time
from lxml import etree
from io import StringIO


class TestTendersListIndexCase(unittest.TestCase):
    def setUp(self):
        self.client = auctions_server.test_client()
        self.parser = etree.HTMLParser()
        self.A = Mock(doc={"_id": "12345",
                           "tenderID": "64568754679",
                           "stages": [{"start": time.strftime('%Y-%m-%dT%H:%M')}]
                          })
        self.B = Mock(doc={"_id": "67890",
                           "tenderID": "42342374623",
                           "stages": [{"start": time.strftime('%Y-%m-%dT%H:%M')}]
                          })
        auctions_server.db = MagicMock()
        auctions_server.db.view = MagicMock(return_value=[self.A, self.B])

    def test_archive_tenders_list_index(self):
        response = self.client.get("/")
        list_html = response.data
        tree = etree.parse(StringIO(unicode(list_html, "utf-8")), self.parser)
        result = etree.tostring(tree.getroot(),
                                pretty_print=True,
                                method="html")
        self.assertTrue(self.A.doc.get("tenderID") in result)

    def test_auction_list_index(self):
        response = self.client.get("/archive")
        list_html = response.data
        tree = etree.parse(StringIO(unicode(list_html, "utf-8")), self.parser)
        result = etree.tostring(tree.getroot(),
                                pretty_print=True,
                                method="html")
        self.assertTrue(self.B.doc.get("tenderID") in result)
