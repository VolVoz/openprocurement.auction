import unittest
import os
from mock import Mock
from openprocurement.auction.auctions_server import auctions_server
import json


class TestHealthViewCase(unittest.TestCase):

    def setUp(self):
        self.client = auctions_server.test_client()
        auctions_server.couch_server = Mock()
        with open(os.path.join(os.path.dirname(__file__), 'data/health_route_test_data.json')) as json_file:
            self.data = json.load(json_file)

    def test_health_good_response(self):
        auctions_server.couch_server.tasks = Mock(return_value=self.data)
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)

    def test_health_bad_response(self):
        self.data[0]['progress'] = 94
        auctions_server.couch_server.tasks = Mock(return_value=self.data)
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 503)