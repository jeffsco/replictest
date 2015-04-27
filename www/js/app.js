// ReplicTest     Timing tests of replication

angular.module('replictest', [ 'ionic', 'ngCordova', 'replictest.ctlr' ])

.run(function($ionicPlatform, $cordovaNetwork) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar above the keyboard
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
})
