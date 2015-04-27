angular.module('replictest.ctlr',
                [ 'ionic', 'ngCordova', 'replictest.results',
                  'replictest.tests' ])

.controller('ReplicTestCtlr', function($rootScope, $scope, $ionicPlatform,
                                        $cordovaNetwork, Results, Tests) {
    $scope.netStatus = '';
    $scope.replCount = 1000;
    $scope.replBlockSize = 100;

    $scope.testReplication = function() {
        var res = {
            nettype: $scope.netStatus,
            count: $scope.replCount,
            blocksize: $scope.replBlockSize
        };

        Tests.insmall_p(res.count)
        .then(function(duration) { res.insmall = duration; })
        .then(function() { return Tests.outsmall_p(res.count); })
        .then(function(duration) { res.outsmall = duration; })
        .then(function() { return Tests.inlarge_p(res.count, res.blocksize); })
        .then(function(duration) { res.inlarge = duration; })
        .then(function() { return Tests.outlarge_p(res.count, res.blocksize); })
        .then(function(duration) { res.outlarge = duration; })
        .then(function() {
            Results.add(res);
            $scope.replResults = Results.all();
        })
    };

    function updateNetStatus()
    {
        $scope.$apply(function() {
            $scope.netStatus = $cordovaNetwork.getNetwork();
        });
    }

    $ionicPlatform.ready(updateNetStatus);
    $rootScope.$on('$cordovaNetwork:online', updateNetStatus);
    $rootScope.$on('$cordovaNetwork:offline', updateNetStatus);

    $scope.replResults = Results.all();
})
