
var	crypto = require("crypto"),
		http = require("https"),
    EventEmitter = require('events').EventEmitter,
    util = require('util');

util.inherits(Client, EventEmitter);

var p = Client.prototype;

p.init = function(username, sharedSecret, environment, options){
	this.environments = {
      sanJose: "api.omniture.com",
      dallas: "api2.omniture.com",
      london: "api3.omniture.com",
      sanJoseBeta: "beta-api.omniture.com",
      dallasBeta: "beta-api2.omniture.com",
      sandbox: "api-sbx1.omniture.com"
    }
	this.username = username;
	this.sharedSecret = sharedSecret;
	this.environment = (environment) ? this.environments[environment] : this.environments.sanJose;
	this.nonce = null;
	this.created = null;
	this.log = (options && options.log) ? options.log : false;
	this.path = "/admin/1.4/rest/";
}

p.logger = function(level, message) {
	if(this.log){
    var levels = ["error", "warn", "info"],
				debugLevel = "info";
    if (levels.indexOf(level) >= levels.indexOf(debugLevel) ) {
      if (typeof message !== "string") {
        message = JSON.stringify(message);
      };
    }
	}
 }

p.request = function(method, parameters, callback){
	var self = this;
	response = this.sendRequest(method, parameters, function(err,data){
		self.logger("info", "API Request Completed");
		// try to parse the data as JSON, if not, return the string of data
		if(err){
			callback(err); 
		}else{
			try{
				var json = JSON.parse(data);
				if(json.error){
					callback(new Error(json.error));
				}else{
					callback(null,json);				
				}
			}catch(e){ // if the string was not json, we just need to return it
				callback(null,data);
			}
		}
	});
}

p.sendRequest = function(method, parameters, callback){
	this.generateNonce();
	var self = this,
			options = {
				host: this.environment,
				path: this.path+"?method="+method,
				headers: this.requestHeaders(),
				method: "POST",
				rejectUnauthorized: false,
				requestCert: false,
				agent: false
			}
    console.log("client.js: REQUEST OPTIONS");
    console.log(JSON.stringify(options));
    console.log("client.js: THE REQUEST PARAMETERS:");
    console.log(JSON.stringify(parameters));

    var request = http.request(options, function(response){
		self.logger("info","HTTP Request Successful");
		var responseData = "";
		// concatenate the response data as we get it
		response.on("data", function(chunk){
			responseData += chunk;
		});
		
			// fire the callback event once the request is completed
		response.on("end", function(e){
			self.logger("info", "API Request Finished");
            console.log('client.js: RESPONSE DATA');
            console.log(responseData);
      self.emit('response', {
        environment: self.environment,
        username: self.username,
        request: {
          method: method,
          parameters: parameters,
        },
        response: responseData,
      });
			callback(null,responseData);
		});
	});
	// log the errors if the request failed
	request.on("error", function(e){
		console.log('client.js: REQUEST FALED: ' + e.message);
		callback(new Error(e.message));
	});
	// send the POST data we"re requesting
	request.write(JSON.stringify(parameters));
	// finally send the request
	request.end();
}

p.generateNonce = function(){
	// lets generate the strings we need for the header
	var randomString = Math.round((new Date().valueOf() * Math.random())) + "";
	this.created = this.formattedCurrentDate();
	this.nonce = crypto.createHash("md5").update(randomString).digest("hex");
	var combinedString = this.nonce+this.created+this.sharedSecret;
	var sha1String = crypto.createHash("sha1").update(combinedString).digest("hex");
	this.password = new Buffer(sha1String).toString("base64").replace(/\n/gi, "");
	this.logger("info", "Generated Nonce: "+ this.nonce);
}

p.formattedCurrentDate = function(){
	// The date formate needs to be %YYYY-%MM-%DDT%H:%M:%SZ
	return  new Date().toISOString().replace(/\.[\d]+Z$/, 'Z');
}

p.requestHeaders = function(){
	// set the header for the request
	this.headers = {
        "X-WSSE": "UsernameToken Username=\""+this.username+"\", "+
									"PasswordDigest=\""+this.password+"\", "+
									"Nonce=\""+this.nonce+"\", "+
									"Created=\""+this.created+"\""
      };
 return this.headers;
}

module.exports = Client;

function Client(username, sharedSecret, environment, options) {
  EventEmitter.call(this);
  this.init(username, sharedSecret, environment, options);
};
