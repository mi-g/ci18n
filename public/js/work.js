
angular.module('ci18n', []);

angular.module('ci18n').controller('WorkCtrl', 
	['$scope', '$http',
	 function ($scope,$http) {
         
         $scope.inCall = 0;

         var defaultManifest = {
             locales_dir: "locales",
             locale_ref: "en-US"
         }

         $scope.init = function() {
             $scope.manifest = null;
             $scope.repoUrl = "";
             $scope.currentLocale = null;
             $scope.currentLocalesData = {};
             $scope.modifiedLocales =[];
             $scope.master = {
                 fullName: null,
                 repo: null,
                 localesMeta: {},
                 localesData: {},
                 localeRefMeta: null,
                 localeRefData: null,
             }
             $scope.forked = {
                 fullName: null,
                 repo: null,
                 localesMeta: {},
                 localesData: {},
                 localeRefMeta: null,
                 localeRefData: null,
             }
         }
         $scope.init();
         $scope.repoUrl = githubUrl || "";
                  
         $scope.closeProject = function() {
             $scope.init();
         }

         $scope.$watch('repoUrl', function(repoUrl) {
             $scope.master.fullName = null;
             if(repoUrl) {
                 var m = /([^\/]+\/[^\/]+?)(?:\.git)?$/.exec(repoUrl);
                 if(m) {
                     $scope.master.fullName = m[1];
                     if(githubUrl) {
                         githubUrl = null; // austart only once
                         $scope.openRepository();
                     }
                 }
             }
         });
         
         $scope.openRepository = function() {
             $scope.master.repo = null;
             $scope.forked.repo = null;
             $scope.apiCall('/repos/'+$scope.master.fullName,{},function(err,repo) {
                if(!err) {
                    $scope.master.repo = repo;
                    $scope.loadRepositoryManifest(function(err,manifest) {
                    $scope.loadRepositoryLocalesInfo($scope.master);
                        $scope.getFork(function(err,repo) {
                            if(!err) {
                                $scope.forked.repo = repo;
                                $scope.loadRepositoryLocalesInfo($scope.forked,function(err) {
                                    if(!err)
                                        Compare();
                                });
                            }
                        });        
                    });
                }
             });
         }
         
         function Compare() {
             $scope.modifiedLocales =[];
             for(var localeFile in $scope.master.localesMeta) {
                 var masterMeta = $scope.master.localesMeta[localeFile];
                 var forkedMeta = $scope.forked.localesMeta[localeFile];
                 if(forkedMeta && masterMeta.sha!=forkedMeta.sha)
                     $scope.modifiedLocales.push(masterMeta.localeName);
             }
            //console.info("Compare");
         }

         $scope.loadRepositoryManifest = function(callback) {
             $scope.master.manifest = null;
             $scope.apiCall('/repos/'+$scope.master.repo.full_name+'/contents/ci18n.json',{
                params: {
                    ref: $scope.master.repo.default_branch,
                }
            },function(err,data) {
                if(!err) {
                    $scope.apiCall(data.download_url,{
                        accept: "application/json",
                        raw: true,
                    },function(err,data) {
                        if(!err) {
                            $scope.master.manifest = angular.merge({},defaultManifest,data);
                        } else
                            $scope.master.manifest = defaultManifest;
                        callback(null,$scope.master.manifest);
                    });        
                } else
                    callback(err);
            });

         }
         
         $scope.loadRepositoryLocalesInfo = function(repoCont,callback) {
             callback = callback || function() {};
             repoCont.localesMeta = {};
             repoCont.localesData = {};
             repoCont.localeRefMeta = null;
             repoCont.localeRefData = null;
             $scope.apiCall('/repos/' + repoCont.repo.full_name + '/contents/' + $scope.master.manifest.locales_dir, {
                 params: {
                     ref: repoCont.repo.default_branch,
                 }
             }, function (err, data) {
                 if (!err) {
                     data.forEach(function (localeMeta) {
                         var m = /^(.*)\.properties$/.exec(localeMeta.name);
                         if (m) {
                             var localeName = m[1];
                             localeMeta.localeName = localeName;
                             if (localeName == $scope.master.manifest.locale_ref) {
                                 repoCont.localeRefMeta = localeMeta;
                                 $scope.loadLocaleData(localeMeta,function(err,localeData) {
                                    if(!err)
                                        repoCont.localeRefData = localeData;
                                 });
                             } else {
                                 repoCont.localesMeta[localeName] = localeMeta;
                             }
                         }
                     });
                     callback(null);
                 } else
                     callback(err);
             });
         }
         
         $scope.loadLocaleData = function(localeMeta, callback) {
             $scope.apiCall(localeMeta.download_url, {
                 accept: "text/plain",
                 raw: true,
             }, function (err, data) {
                 if (!err) {
                     var localeData = {};
                     data.split("\n").forEach(function (line) {
                         var m = /^\s*([^=]+?)\s*=\s*(.*?)$/.exec(line);
                         if (m)
                             localeData[m[1]] = m[2];
                     });
                     callback(null, localeData);
                 } else
                     callback(err);
             });
         }
                  
         $scope.pickLocale = function(locale) {
             $scope.currentLocale = locale;
             $scope.currentLocalesData[locale] = $scope.currentLocalesData[locale] || {};
             var tasks = 1;
             function Done() {
                 if(--tasks)
                     return;
                 var currentLocalesData = $scope.currentLocalesData[locale];
                 var forkedLocalesData = $scope.forked.repo && $scope.forked.localesData[locale];
                 for(var tag in $scope.master.localeRefData) {
                     currentLocalesData[tag] = "";
                     if(forkedLocalesData)
                         currentLocalesData[tag] = forkedLocalesData[tag];
                     if(!currentLocalesData[tag] && $scope.master.localesData[locale])
                         currentLocalesData[tag] = $scope.master.localesData[locale][tag];
                     currentLocalesData[tag] = currentLocalesData[tag] || "";
                 }
             }
             if($scope.master.localesMeta[locale]) {
                 tasks++;
                 $scope.loadLocaleData($scope.master.localesMeta[locale],function(err,localeData) {
                     if(localeData)
                        $scope.master.localesData[locale] = localeData;
                     Done();
                });
             }
             if($scope.forked.localesMeta[locale]) {
                 tasks++;
                 $scope.loadLocaleData($scope.forked.localesMeta[locale],function(err,localeData) {
                     if(localeData)
                        $scope.forked.localesData[locale] = localeData;
                     Done();
                 });
             }
             Done();
         }
         
         $scope.isModified = function() {
             if($scope.inCall>0)
                 return false;
             if(!$scope.forked.repo)
                 return true;
             for(var locale in $scope.currentLocalesData) {
                 console.info("isModified locale",locale);
                 if($scope.forked.localesData[locale] && !angular.equals($scope.currentLocalesData[locale],$scope.forked.localesData[locale]))
                     return true;
                 console.info("isModified unchanged");
             }
             return false;
         }

          $scope.getFork = function(callback) {
             $scope.apiCall('/user',{},function(err,user) {
                 if(err) 
                     return callback(err);
                 $scope.apiCall('/repos/'+user.login+'/'+$scope.master.repo.name,{},function(err,repo) {
                     if(err) return callback(err);
                     if(repo.fork && repo.parent.full_name==$scope.master.repo.full_name)
                         callback(null,repo);
                     else
                         callback(new Error("Not a forked version"));
                 });                 
             });             
         }
         

         $scope.save = function() {
             $scope.saveData = {
                 changes: [],
             }
             Object.keys($scope.currentLocalesData).forEach(function(locale) {
                 var changeCount = 0;
                 Object.keys($scope.currentLocalesData[locale]).forEach(function(tag) {
                    if(!$scope.forked.repo || !$scope.forked.localesData[locale] || $scope.currentLocalesData[locale][tag]!=$scope.forked.localesData[locale][tag])
                        changeCount++;
                 });
                 if(changeCount>0)
                     $scope.saveData.changes.push({
                         locale: locale,
                         count: changeCount,
                     })
             });
            $("#commit-dialog").modal("show");
         }
         
         $scope.doSave = function() {
             if(!$scope.forked.repo) {
                 $scope.apiCall('/repos/'+$scope.master.repo.full_name+"/forks",{
                     method: 'POST',
                 },function(err,repo) {
                    if(!err) {
                        $scope.forked.repo = repo;
                        SaveFiles();
                    }
                 });
             } else
                 SaveFiles();
             function SaveFiles() {
                 var tasks = $scope.saveData.changes.length;
                 function Done() {
                     if(--tasks==0) {
                         $scope.openRepository();
                         $("#commit-dialog").modal("hide");                 
                     }
                 }
                 $scope.saveData.changes.forEach(function(change) {
                     var filePath = $scope.master.manifest.locales_dir+"/"+change.locale+".properties";
                     $scope.apiCall('/repos/'+$scope.forked.repo.full_name+'/contents/'+filePath,{
                         params: {
                             ref: $scope.forked.repo.default_branch,
                         }
                     },function(err,fileMeta) {
                         if(!err) {
                             var lines = [];
                             for(var tag in $scope.currentLocalesData[change.locale]) {
                                 var value = $scope.currentLocalesData[change.locale][tag] || "";
                                 lines.push(tag+"="+value);
                             }
                             var byteArray = UnicodeStringToTypedArray(lines.join("\n")+"\n");
                             var base64 = BufferToBase64(byteArray);
                             var updateData = {
                                 path: filePath,
                                 message: "updated "+change.count+" in "+change.locale,
                                 content: base64,
                                 sha: fileMeta.sha,
                             };
                             $scope.apiCall('/repos/'+$scope.forked.repo.full_name+'/contents/'+filePath,{
                                 method: 'PUT',
                                 params: updateData,
                             },function(err,data) {
                                 Done();
                             });
                         }
                     });
                 });
             }
         }
         
         function UnicodeStringToTypedArray(s) {
             var escstr = encodeURIComponent(s);
             var binstr = escstr.replace(/%([0-9A-F]{2})/g, function(match, p1) {
                 return String.fromCharCode('0x' + p1);
             });
             var ua = new Uint8Array(binstr.length);
             Array.prototype.forEach.call(binstr, function (ch, i) {
                 ua[i] = ch.charCodeAt(0);
             });
             return ua;
         }
         function BufferToBase64(buf) {
             var binstr = Array.prototype.map.call(buf, function (ch) {
                 return String.fromCharCode(ch);
             }).join('');
             return btoa(binstr);
         }
         
         $scope.forkedDiff = function(locale,tag) {
             if(!locale)
                 return false;
             if($scope.forked.repo && $scope.forked.localesData[locale] && $scope.master.localesData[locale] &&
               $scope.forked.localesData[locale][tag]!=$scope.master.localesData[locale][tag])
                 return true;
            return false;
         }
         
         $scope.apiCall = function(path,options,callback) {
             options.method = options.method || 'GET';
             options.params = options.params || {};
             callback = callback || function() {};
             var data = undefined;
             if(options.method=='GET') {
                 var params = Object.keys(options.params);
                 if(params.length>0)
                     path+="?";
                 params.forEach(function(param) {
                    path += param + "=" + encodeURIComponent(options.params[param]);
                 });
             } else {
                 data = options.params;
             }
             var headers = {
                'Accept': options.accept || 'application/vnd.github.v3+json',
             };
             if(!options.raw && typeof githubOauthToken!="undefined" && githubOauthToken)
                 headers.Authorization = "token "+githubOauthToken;
             var url = options.raw ? path : 'https://api.github.com'+path;
             var req = {
                 method: options.method,
                 url: url,
                 headers: headers,
                 data: data,               
             };
             $scope.inCall++;
             $http(req).then(function(resp) {
                 $scope.inCall--;
                 //console.info("apiCall",path,resp.data);
                 callback(null,resp.data || null);
             }, function(err) {
                 $scope.inCall--;
                 console.warn("apiCall",path,"error",err);
                 callback(err);
             });
         }
              
     }]);
