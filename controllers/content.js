/* 
 * Copyright (c) 2015 Michel Gutierrez
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

var request = require('request');

var exskel = require("./exskel");
var config = require("../config");

const WORKPATH = "/";

MakeShortId = function() {
	var b = "aA0";
	var r = [];
	for(var i=0;i<5;i++) {
		var v = Math.floor(Math.random()*62);
		if(v<26)
			r.push(String.fromCharCode(b.charCodeAt(0)+v));
		else if(v<52)
			r.push(String.fromCharCode(b.charCodeAt(1)+v-26));
		else
			r.push(String.fromCharCode(b.charCodeAt(2)+v-52));
	}
	return r.join("");
}
var salt = MakeShortId();

module.exports = function(app) {
	app.get("/about",function(req, res) {
		res.render('page-1col',exskel.locals(req,{
			content: 'about',
		}));
	});
	app.get(WORKPATH,function(req, res) {
        if(req.query.token) {
            req.session.oauthToken = req.query.token;
            res.redirect(WORKPATH);
            return;
        }
        if(req.query.logout) {
            delete req.session.oauthToken;
            res.redirect(WORKPATH);
            return;
        }
        console.info("session",req.session && req.session.oauthToken);
        var loginUrl = "https://github.com/login/oauth/authorize?"+
            "client_id="+encodeURIComponent(config.githubAppClientId)+
            "&state="+encodeURIComponent(salt)+
            "&scope="+encodeURIComponent("public_repo,repo");
        //req.session.oauthToken = req.query.token || req.session.oauthToken;
        //if(req.query.logout)
        //    delete req.session.oauthToken;
		res.render('page-1col',exskel.locals(req,{
			content: 'work',
            loginUrl: loginUrl,
            githubOauthToken: req.session.oauthToken || null,
            githubUrl: req.query.url || null,
            scripts: ['/js/angular.js','/js/work.js','/js/start-angular.js'],
		}));
	});
	app.get("/oauth-callback",function(req, res) {
        console.info("oauth-callback code",req.query.code);
        request.post('https://github.com/login/oauth/access_token',{
            form: {
                client_id: config.githubAppClientId,
                client_secret: config.githubAppClientSecret,
                code: req.query.code,
                state: salt,
            },
            headers: {
                Accept: "application/json",    
            }
        },function(error, response, body) {
            console.info("Resp",error,response.statusCode,typeof body,body);
            var responseData = JSON.parse(body);
            res.redirect('/work?token='+encodeURIComponent(responseData.access_token));
        });
    });
	app.get("/authenticated",function(req, res) {
        console.info("authenticated");
        res.send(200);
    });
}

