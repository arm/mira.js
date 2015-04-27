var express = require('express');
var app = express();

var five = require('johnny-five');
var Arm = require('./arm.js');

var board = new five.Board({
	repl: false
});

var fps = 30;

var isReady = false;

board.on('ready', function() {
	arm = new Arm(this, fps); // todo: remove status var
	arm.init();
	isReady = true;
});

app.use(express.static(__dirname+'/public'));

app.get('/arm', function(req, res) { // update later
	res.json({ready: isReady});
});

app.post('/arm/from_hand', function(req, res) {
	var pos = toCoords(hand.palmPosition, leapBounds);

	var pinch = hand.pinchStrength;

	var roll = radToDeg(hand.roll()); // -90: facing left, 90: facing right
	var pitch = radToDeg(hand.pitch()); // -90: down, 90: up

	arm.setPinch(pinch);
	arm.setRoll( (roll + 90) / 180 );
	arm.to(pos.x, pos.y, pos.z);
	arm.setPitch( (pitch + 90) / 180);
	arm.commitState();
});

var server = app.listen(3000, function () {

	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at http://%s:%s', host, port);
});
