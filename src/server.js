var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var five = require('johnny-five');
var Arm = require('./arm.js');


var fps = 30;

var isReady = false;

var board = new five.Board({
	repl: false
});

board.on('ready', function() {
	arm = new Arm(this, fps); // todo: remove status var
	arm.init();
});

app.use(express.static(__dirname+'/public'));
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}));

app.route('/arm')
.post(function(req, res) { // update later
	board = new five.Board({
		repl: false
	});

	board.on('ready', function() {
		arm = new Arm(this, fps); // todo: remove status var
		arm.init();
		res.json({ready: true});
	});
});

app.post('/arm/state', function(req, res) {
	var parsed = JSON.parse(req.body.data);
	// console.log(parsed);
	var x = parsed.x;
	var y = parsed.y;
	var z = parsed.z;

	var pitch = parsed.pitch;
	var roll = parsed.roll;
	var pinch = parsed.pinch;

	arm.to(x, y, z);
	arm.setPitch(pitch);
	arm.setRoll(roll);
	arm.setPinch(parsed.pinch);
	arm.commitState();

	res.json({success: true});
});

app.post('/arm/blink/start', function(req, res) {
	arm.startBlink();
	res.json({success: true});
});

var server = app.listen(3000, function () {

	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at http://%s:%s', host, port);
});
