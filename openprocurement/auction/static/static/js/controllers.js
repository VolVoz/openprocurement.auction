var evtSrc = {};

var dataLayer = dataLayer || [];

angular.module('auction').controller('AuctionController', [
  '$scope', 'AuctionConfig', 'AuctionUtils',
  '$timeout', '$http', '$log', '$cookies', '$cookieStore', '$window',
  '$rootScope', '$location', '$translate', '$filter', 'growl', 'growlMessages', 'aside', '$q',
  function(
    $scope, AuctionConfig, AuctionUtils,
    $timeout, $http, $log, $cookies, $cookieStore, $window,
    $rootScope, $location, $translate, $filter, growl, growlMessages, $aside, $q
  ) {
    if (AuctionUtils.inIframe()) {
      $log.error('Starts in iframe');
      window.open(location.href, '_blank');
      return false;
    }
    $scope.lang = 'uk';
    $scope.format_date = AuctionUtils.format_date;
    $scope.bidder_id = null;
    $scope.bid = null;
    $scope.allow_bidding = true;
    $rootScope.form = {};
    $rootScope.alerts = [];
    $scope.default_http_error_timeout = 500;
    $scope.http_error_timeout = $scope.default_http_error_timeout;
    $scope.start = function() {
      var params = AuctionUtils.parseQueryString(location.search);
      if ($cookies.auctions_loggedin) {
        AuctionConfig.remote_db = AuctionConfig.remote_db + "_secured";
      }

      new PouchDB(AuctionConfig.remote_db, {
        skipSetup: true
      }).then(function(db) {
        $scope.db = db;
        $scope.http_error_timeout = $scope.default_http_error_timeout;
        $scope.start_auction_process();
      }).catch(function(err) {
        $log.debug("Error", err);
        $scope.http_error_timeout = $scope.http_error_timeout * 2;
        $timeout(function() {
          $scope.start();
        }, $scope.http_error_timeout);
      });
    };



    $scope.growlMessages = growlMessages;
    growlMessages.initDirective(0, 10);

    dataLayer.push({
      "tenderId": AuctionConfig.auction_doc_id
    });


    if (($translate.storage().get($translate.storageKey()) === "undefined") || ($translate.storage().get($translate.storageKey()) === undefined)) {
      $translate.use(AuctionConfig.default_lang);
      $scope.lang = AuctionConfig.default_lang;
    } else {
      $scope.lang = $translate.storage().get($translate.storageKey()) || $scope.lang;
    }

    /*      Time tick events    */
    $scope.$on('timer-tick', function(event) {
      if (($scope.auction_doc) && (event.targetScope.timerid == 1)) {
        if (((($rootScope.info_timer || {}).msg || "") === 'until your turn') && (event.targetScope.minutes == 1) && (event.targetScope.seconds == 50)) {
          $http.post('./check_authorization').success(function(data) {
            $log.debug("Authorization checked");
          }).error(function(data, status, headers, config) {
            dataLayer.push({
              "event": "JS.error",
              "MESSAGE": "Error while check_authorization"
            });
            if (status == 401) {
              growl.error('Ability to submit bids has been lost. Wait until page reloads.');
              dataLayer.push({
                "event": "JS.error",
                "MESSAGE": "Unauthorized error while post bid"
              });
              $timeout(function() {
                window.location.replace(window.location.href + '/relogin');
              }, 3000);
            }
          });
        };
        $timeout(function() {
          $scope.time_in_title = event.targetScope.days ? (event.targetScope.days + $filter('translate')('days') + " ") : "";
          $scope.time_in_title += event.targetScope.hours ? (AuctionUtils.pad(event.targetScope.hours) + ":") : "";
          $scope.time_in_title += (AuctionUtils.pad(event.targetScope.minutes) + ":");
          $scope.time_in_title += (AuctionUtils.pad(event.targetScope.seconds) + " ");
        }, 10);
      } else {
        var date = new Date();
        $scope.seconds_line = AuctionUtils.polarToCartesian(24, 24, 16, (date.getSeconds() / 60) * 360);
        $scope.minutes_line = AuctionUtils.polarToCartesian(24, 24, 16, (date.getMinutes() / 60) * 360);
        $scope.hours_line = AuctionUtils.polarToCartesian(24, 24, 14, (date.getHours() / 12) * 360);
      }
    });


    /*      Kick client event    */

    $scope.$on('kick_client', function(event, client_id, msg) {
      $log.debug('Kick client connection', client_id, msg);
      $scope.growlMessages.deleteMessage(msg);
      $http.post('./kickclient', {
        'client_id': client_id
      }).success(
        function(data) {
          $log.debug('disable connection', client_id, msg);
        });
    });
    //


    $scope.start_subscribe = function(argument) {
      var unsupported_browser = unsupported_browser || null;
      if (unsupported_browser) {
        $timeout(function() {
          $scope.unsupported_browser = true;
          growl.error($filter('translate')('Your browser is out of date, and this site may not work properly.') + '<a style="color: rgb(234, 4, 4); text-decoration: underline;" href="https://browser-update.org/uk/update.html">' + $filter('translate')('Learn how to update your browser.') + '</a>');
        }, 500);
      };
      dataLayer.push({
        "event": "EventSource.Start"
      });
      response_timeout = $timeout(function() {
        $http.post('./set_sse_timeout', {
          timeout: '7'
        }).success(function(data) {
          dataLayer.push({
            "event": "EventSourceSetTimeout",
            "data": data
          });
        });
        dataLayer.push({
          "event": "EventSource.ResponseTimeout"
        });
      }, 20000);
      evtSrc = new EventSource(window.location.href.replace(window.location.search, '') + '/event_source', {
        'withCredentials': true
      });
      $scope.restart_retries_events = 3;
      evtSrc.addEventListener('ClientsList', function(e) {
        var data = angular.fromJson(e.data);
        $log.debug("New ClientsList: ", data);
        dataLayer.push({
          "event": "EventSource.ClientsList"
        });
        $scope.$apply(function() {
          var i;
          if (angular.isObject($scope.clients)) {
            for (i in data) {
              if (!(i in $scope.clients)) {
                growl.warning($filter('translate')('In the room came a new user') + ' (IP:' + data[i].ip + ')' + '<button type="button" ng-click="$emit(\'kick_client\', + \'' + i + '\', message )" class="btn btn-link">' + $filter('translate')('prohibit connection') + '</button>', {
                  ttl: 30000,
                  disableCountDown: true
                });
              }
            }
          }
          $scope.clients = data;
        });

      }, false);
      evtSrc.addEventListener('Tick', function(e) {
        $scope.restart_retries_events = 3;
        var data = angular.fromJson(e.data);
        $scope.last_sync = new Date(data.time);
        $log.debug("Tick: ", data);
        if ($scope.auction_doc.current_stage > -1) {
          $rootScope.info_timer = AuctionUtils.prepare_info_timer_data($scope.last_sync, $scope.auction_doc, $scope.bidder_id, $scope.Rounds);
          $log.debug("Info timer data:", $rootScope.info_timer);
          $rootScope.progres_timer = AuctionUtils.prepare_progress_timer_data($scope.last_sync, $scope.auction_doc);
          $log.debug("Progres timer data:", $rootScope.progres_timer);
        }
      }, false);
      evtSrc.addEventListener('Identification', function(e) {
        if (response_timeout) {
          $timeout.cancel(response_timeout);
        }
        var data = angular.fromJson(e.data);
        dataLayer.push({
          "event": "EventSource.Identification",
          "data": data
        });
        $log.debug("Identification: ", data);
        $scope.start_sync_event.resolve('start');
        $scope.$apply(function() {
          $scope.bidder_id = data.bidder_id;
          $scope.client_id = data.client_id;
          $scope.return_url = data.return_url;
        });
      }, false);

      evtSrc.addEventListener('RestoreBidAmount', function(e) {
        if (response_timeout) {
          $timeout.cancel(response_timeout);
        }
        var data = angular.fromJson(e.data);
        dataLayer.push({
          "event": "EventSource.RestoreBidAmount",
          "data": data
        });
        $log.debug("RestoreBidAmount: ", data);
        $scope.$apply(function() {
          $rootScope.form.bid = data.last_amount;
        });
      }, false);

      evtSrc.addEventListener('KickClient', function(e) {
        var data = angular.fromJson(e.data);
        dataLayer.push({
          "event": "EventSource.KickClient"
        });
        $log.debug("You are must logout: ", data);
        window.location.replace(window.location.protocol + '//' + window.location.host + window.location.pathname + '/logout');
      }, false);
      evtSrc.addEventListener('Close', function(e) {
        $timeout.cancel(response_timeout);
        dataLayer.push({
          "event": "EventSource.Close"
        });
        if (!$scope.follow_login_allowed) {
          growl.info($filter('translate')('You are an observer and cannot bid.'), {
            ttl: -1,
            disableCountDown: true
          });
          var params = AuctionUtils.parseQueryString(location.search);
          if (params.loggedin) {
            $timeout(function() {
              window.location.replace(window.location.protocol + '//' + window.location.host + window.location.pathname);
            }, 1000);
          }
        }
        $log.debug("You are must logout ");
        $scope.start_sync_event.resolve('start');
        evtSrc.close();
      }, false);
      evtSrc.onerror = function(e) {
        $timeout.cancel(response_timeout);
        dataLayer.push({
          "event": "EventSource.Error",
          "data": e
        });
        $scope.restart_retries_events = $scope.restart_retries_events - 1;
        $log.debug("EventSource failed.", e);
        if ($scope.restart_retries_events === 0) {
          evtSrc.close();
          $log.debug("EventSource Stoped.", e);
          if (!$scope.follow_login_allowed) {
            growl.info($filter('translate')('You are an observer and cannot bid.'), {
              ttl: -1,
              disableCountDown: true
            });
          }
        }
        return true;
      };
    };
    $scope.changeLanguage = function(langKey) {
      $translate.use(langKey);
      $scope.lang = langKey;
    };
    // Bidding form msgs
    $scope.closeAlert = function(msg_id) {
      for (var i = 0; i < $rootScope.alerts.length; i++) {
        if ($rootScope.alerts[i].msg_id == msg_id) {
          $rootScope.alerts.splice(i, 1);
          return true;
        }
      }
    };
    $scope.auto_close_alert = function(msg_id) {
      $timeout(function() {
        $scope.closeAlert(msg_id);
      }, 4000);
    };
    $scope.get_round_number = function(pause_index) {
      return AuctionUtils.get_round_data(pause_index, $scope.auction_doc, $scope.Rounds);
    };
    $scope.show_bids_form = function(argument) {
      if ((angular.isNumber($scope.auction_doc.current_stage)) && ($scope.auction_doc.current_stage >= 0)) {
        if (($scope.auction_doc.stages[$scope.auction_doc.current_stage].type == 'bids') && ($scope.auction_doc.stages[$scope.auction_doc.current_stage].bidder_id == $scope.bidder_id)) {
          return true;
        }
      }
      return false;
    };

    $scope.sync_times_with_server = function(start) {
      $http.get('/get_current_server_time', {
        'params': {
          '_nonce': Math.random().toString()
        }
      }).success(function(data, status, headers, config) {
        $scope.last_sync = new Date(new Date(headers().date));
        $rootScope.info_timer = AuctionUtils.prepare_info_timer_data($scope.last_sync, $scope.auction_doc, $scope.bidder_id, $scope.Rounds);
        $log.debug("Info timer data:", $rootScope.info_timer);
        $rootScope.progres_timer = AuctionUtils.prepare_progress_timer_data($scope.last_sync, $scope.auction_doc);
        $log.debug("Progres timer data:", $rootScope.progres_timer);
        var params = AuctionUtils.parseQueryString(location.search);
        if ($scope.auction_doc.current_stage === -1 && params.wait) {
          $scope.follow_login_allowed = true;
          if ($rootScope.progres_timer.countdown_seconds < 900) {
            $scope.follow_login = true;
          } else {
            $scope.follow_login = false;
            $timeout(function() {
              $scope.follow_login = true;
            }, ($rootScope.progres_timer.countdown_seconds - 900) * 1000);
          }
          $scope.login_params = params;
          delete $scope.login_params.wait;
          $scope.login_url = './login?' + AuctionUtils.stringifyQueryString($scope.login_params);
        } else {
          $scope.follow_login_allowed = false;
        }
      }).error(function(data, status, headers, config) {

      });
    };
    $scope.post_bid = function(bid) {
      if (parseFloat($rootScope.form.bid) == -1) {
        msg_id = Math.random();
        $rootScope.alerts.push({
          msg_id: msg_id,
          type: 'danger',
          msg: 'To low value'
        });
        $scope.auto_close_alert(msg_id);
        return 0;
      }
      if ($rootScope.form.BidsForm.$valid) {
        $rootScope.alerts = [];
        var bid_amount = parseFloat(bid) || parseFloat($rootScope.form.bid) || 0;
        if ( bid_amount == $scope.minimal_bid.amount) {
            msg_id = Math.random();
            $rootScope.alerts.push({
              msg_id: msg_id,
              type: 'warning',
              msg: 'The proposal you have submitted coincides with a proposal of the other participant. His proposal will be considered first, since it has been submitted earlier.'
            });
        }
        $rootScope.form.active = true;
        $timeout(function() {
          $rootScope.form.active = false;
        }, 5000);
        $http.post('./postbid', {
            'bid': parseFloat(bid) || parseFloat($rootScope.form.bid) || 0,
            'bidder_id': $scope.bidder_id || bidder_id || "0"
          }).success(function(data) {
            $rootScope.form.active = false;
            var msg_id = '';
            if (data.status == 'failed') {
              for (var error_id in data.errors) {
                for (var i in data.errors[error_id]) {
                  msg_id = Math.random();
                  $rootScope.alerts.push({
                    msg_id: msg_id,
                    type: 'danger',
                    msg: data.errors[error_id][i]
                  });
                  $scope.auto_close_alert(msg_id);
                }
              }
            } else {
              var bid = data.data.bid;
              if ((bid <= ($scope.max_bid_amount() * 0.1)) && (bid != -1)) {
                msg_id = Math.random();
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'warning',
                  msg: 'Your bid appears too low'
                });
              }
              msg_id = Math.random();

              if (bid == -1) {
                $rootScope.alerts = [];
                $scope.allow_bidding = true;
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'success',
                  msg: 'Bid canceled'
                });
                $rootScope.form.bid = "";
              } else {
                $rootScope.alerts.push({
                  msg_id: msg_id,
                  type: 'success',
                  msg: 'Bid placed'
                });
                $scope.allow_bidding = false;
              }
              $scope.auto_close_alert(msg_id);
            }

          })
          .error(function(data, status, headers, config) {
            if (status == 401) {
              $rootScope.alerts.push({
                msg_id: Math.random(),
                type: 'danger',
                msg: 'Ability to submit bids has been lost. Wait until page reloads, and retry.'
              });
              dataLayer.push({
                "event": "JS.error",
                "MESSAGE": "Unauthorized error while post bid"
              });
              relogin = function() {
                window.location.replace(window.location.href + '/relogin?amount=' + $rootScope.form.bid);
              }
              $timeout(relogin, 3000);
            } else {
              dataLayer.push({
                "event": "JS.error",
                "MESSAGE": "Unhandled Error while post bid"
              });
              $scope.post_bid();
            }
          });
      }
    };
    $scope.edit_bid = function() {
      $scope.allow_bidding = true;
    };

    $scope.max_bid_amount = function() {
      var amount = 0;
      if ((angular.isString($scope.bidder_id)) && (angular.isObject($scope.auction_doc)) && (angular.isObject($scope.auction_doc.stages[$scope.auction_doc.current_stage]))) {
        amount = $scope.auction_doc.stages[$scope.auction_doc.current_stage].amount - $scope.auction_doc.minimalStep.amount;
      }
      if (amount < 0) {
        return 0;
      }
      return amount;
    };
    $scope.calculate_minimal_bid_amount = function() {
      if ((angular.isObject($scope.auction_doc)) && (angular.isArray($scope.auction_doc.stages)) && (angular.isArray($scope.auction_doc.initial_bids))) {
        var bids = [];
        filter_func = function(item, index) {
          if (!angular.isUndefined(item.amount)) {
            bids.push(item);
          }
        };
        $scope.auction_doc.stages.forEach(filter_func);
        $scope.auction_doc.initial_bids.forEach(filter_func);
        $scope.minimal_bid = bids.sort(function(a, b) {
          if (a.amount == b.amount) {
            return Date.parse(a.time || "") - Date.parse(b.time || "");
          }
          return a.amount - b.amount;
        })[0];
      }
    };
    $scope.start_sync = function() {
      $scope.changes = $scope.db.changes({
        live: true,
        style: 'main_only',
        continuous: true,
        include_docs: true,
        doc_ids: [AuctionConfig.auction_doc_id],
        since: 0
      }).on('change', function(resp) {
        $log.debug('Change: ', resp);
        $scope.restart_retries = AuctionConfig.restart_retries;
        if (resp.id == AuctionConfig.auction_doc_id) {
          $scope.replace_document(resp.doc);
          if ($scope.auction_doc.current_stage == ($scope.auction_doc.stages.length - 1)) {
            $scope.changes.cancel();
          }
        }
      }).on('error', function(err) {
        $log.error('Changes error: ', err);
        $timeout(function() {
          if ($scope.restart_retries != AuctionConfig.restart_retries) {
            growl.warning('Internet connection is lost. Attempt to restart after 1 sec', {
              ttl: 1000
            });
          }
          $scope.restart_retries -= 1;
          if ($scope.restart_retries) {
            $log.debug('Start restart feed pooling...');
            $scope.restart_changes();
          } else {
            growl.error('Synchronization failed');
            $log.error('Restart synchronization not allowed.', AuctionConfig.restart_retries);
          }
        }, 1000);
      });
    };
    $scope.start_auction_process = function() {
      $scope.db.get(AuctionConfig.auction_doc_id, function(err, doc) {
        if (err) {
          if (err.status == 404) {
            $log.error('Not Found Error:', err);
            $rootScope.document_not_found = true;
          } else {
            $log.debug("Server Error:", err);
            $scope.http_error_timeout = $scope.http_error_timeout * 2;
            $timeout(function() {
              $scope.start_auction_process()
            }, $scope.http_error_timeout);
          }
          return;
        }
        $scope.http_error_timeout = $scope.default_http_error_timeout;
        // ad
        var params = AuctionUtils.parseQueryString(location.search);

        $scope.start_sync_event = $q.defer();
        $timeout(function() {
          $scope.start_sync_event.resolve('start');
        }, 5000);
        // 
        if (doc.current_stage === -1 && params.wait) {
          $scope.follow_login_allowed = true;
        } else {
          $scope.follow_login_allowed = false;
        };
        $scope.title_ending = AuctionUtils.prepare_title_ending_data(doc, $scope.lang);
        $scope.replace_document(doc);
        $scope.document_exists = true;
        $scope.scroll_to_stage();
        if ($scope.auction_doc.current_stage != ($scope.auction_doc.stages.length - 1)) {
          if ($cookieStore.get('auctions_loggedin')) {
            $scope.start_subscribe();
          } else {
            $log.debug("Start anonimous")
            $scope.start_sync_event.resolve('start');
            $timeout(function() {
              growl.info($filter('translate')('You are an observer and cannot bid.'), {
                ttl: -1,
                disableCountDown: true
              });
            }, 500)
          }
          $scope.restart_retries = AuctionConfig.restart_retries;
          $scope.start_sync_event.promise.then(function() {
            $scope.sync = $scope.start_sync()
          });
        } else {
          // TODO: CLEAR COOKIE
          // if ($cookieStore.get('auctions_loggedin')) {
          //   $cookieStore.remove('auctions_loggedin');
          //   $timeout(function() {
          //     window.location.replace(window.location.protocol + '//' + window.location.host + window.location.pathname);
          //   }, 1000);
          // }
        }
      });
    };
    $scope.restart_changes = function() {
      $scope.changes.cancel();
      $timeout(function() {
        $scope.start_sync();
      }, 1000);
    };
    $scope.replace_document = function(new_doc) {
      $rootScope.$apply(function(argument) {
        if ((angular.isUndefined($scope.auction_doc)) || (new_doc.current_stage - $scope.auction_doc.current_stage === 0) || (new_doc.current_stage === -1)) {
          $scope.auction_doc = new_doc;
        } else {
          $rootScope.form.bid = null;
          $scope.allow_bidding = true;
          $scope.auction_doc = new_doc;
        }
        $scope.sync_times_with_server();
        $scope.calculate_rounds();
        $scope.calculate_minimal_bid_amount();
        $scope.scroll_to_stage();
      });
    };
    $scope.calculate_rounds = function(argument) {
      $scope.Rounds = [];
      $scope.auction_doc.stages.forEach(function(item, index) {
        if (item.type == 'pause') {
          $scope.Rounds.push(index);
        }
      });
    };
    $scope.scroll_to_stage = function() {
      AuctionUtils.scroll_to_stage($scope.auction_doc, $scope.Rounds);
    };
    $scope.array = function(int) {
      return new Array(int);
    };
    $scope.open_menu = function() {
      var modalInstance = $aside.open({
        templateUrl: 'templates/menu.html',
        controller: 'OffCanvasController',
        scope: $scope,
        size: 'lg'
      });
    };
    $scope.start();
  }
]);


angular.module('auction').controller('OffCanvasController', ['$scope', '$modalInstance',
  function($scope, $modalInstance) {
    $scope.allert = function() {
      console.log($scope);
    };
    $scope.ok = function() {
      $modalInstance.close($scope.selected.item);
    };
    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
]);


angular.module('auction').directive('nghReplace', function($compile, $parse, $rootScope) {
  return {
    replace: true,
    link: function(scope, element, attr) {
      scope.$watch(attr.content, function() {
        element.html($parse(attr.content)(scope));
        $compile(element.contents())(scope);
      }, true);
    }
  };
});

angular.module('auction')
  .directive('format', ['$filter', function($filter) {
    return {
      require: '?ngModel',
      link: function(scope, elem, attrs, ctrl) {
        if (!ctrl) return;
        ctrl.$formatters.unshift(function(value) {
          return $filter('formatnumber')(value);
        });

        ctrl.$parsers.unshift(function(viewValue) {
          var plainNumber = (viewValue || "").replace(/ /g, '');
          ctrl.$viewValue = $filter('formatnumber')(plainNumber);
          ctrl.$render();
          return plainNumber;
        });
      }
    };
  }]);


angular.module('auction')
  .directive('svgTimer', function() {
    return {

      templateNamespace: 'svg',
      template: '<g><circle cx="24" cy="24" r="21"  stroke="#494949" stroke-width="5" fill="#DBDBDB" />' + '<line x1="24" y1="24" ng-attr-x2="{{minutes_line.x}}" ng-attr-y2="{{minutes_line.y}}" stroke="#15293D" style="stroke-width:2" />' + '<line x1="24" y1="24" ng-attr-x2="{{seconds_line.x}}" ng-attr-y2="{{seconds_line.y}}" stroke="#88BDA4" style="stroke-width:1" />' + '<line x1="24" y1="24" ng-attr-x2="{{hours_line.x}}" ng-attr-y2="{{hours_line.y}}" stroke="#26374A" style="stroke-width:2" />' + '<path ng-attr-d="{{arc_params}}" fill="#A5A5A5" />' + '<circle cx="24" cy="24" r="2.5" stroke="white" stroke-width="1.5" fill="192B3F" /></g>',
      restrict: 'E',
      replace: true
    };
  });