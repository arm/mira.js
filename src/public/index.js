var leapBounds = {
	x: {
		min: -200,
		max: 200
	},
	y: {
		min: 150,
		max: 500
	},
	z: {
		min: -200,
		max: 200
	}
}

var recording = false;
var tracking = true;
var fps = 30;
var playButton;

window.onload = function() {
	initInterface();
	useLeapMotion();
}

function initInterface() {
	var recordButton = document.getElementById('record');
	recordButton.onclick = function() {
		if (!recording) {
			recording = true;
			recordButton.innerHTML = 'stop';
			history = [];
		}
		else {
			recording = false;
			recordButton.innerHTML = 'record';
		}
	}
	playButton = document.getElementById('play');
	playButton.onclick = function() {
		if (tracking && history.length > 0 && !recording) {
			playButton.innerHTML = 'playing...';
			playHistory();
		}
	}
	var trackingButton = document.getElementById('tracking');
	trackingButton.onclick = function() {
		if (tracking) {
			tracking = false;
			trackingButton.innerHTML = 'resume tracking'
		}
		else {
			tracking = true;
			trackingButton.innerHTML = 'pause tracking'
		}
	}
}

function useLeapMotion(arm) {
	var controller = new Leap.Controller();
	controller.on('connect', function() {
		setInterval(function() {
			var frame = controller.frame();
			handleFrame(frame);
		}, 1000 / fps);
	});
	controller.connect();
	function handleFrame(frame) {
		if (frame.hands.length > 0 && tracking) {
			var hand = frame.hands[0];
			// var box = frame.interactionBox;
			// var pos = toCoords(box.normalizePoint(hand.palmPosition, true));
			var state = {};
			
			var pos = toCoords(hand.palmPosition, leapBounds);
			state['x'] = pos.x;
			state['y'] = pos.y;
			state['z'] = pos.z;
			state['pinch'] = hand.pinchStrength;

			if (hand.type === 'right') {
				var roll = clamp(radToDeg(hand.roll()) + 30, -90, 90); // -90: facing left, 90: facing right
			}
			else {
				var roll = clamp(radToDeg(hand.roll()) - 30, -90, 90); // -90: facing left, 90: facing right
			}
			var pitch = radToDeg(hand.pitch()); // -90: down, 90: up

			state['roll'] = (roll + 90) / 180;
			state['pitch'] = (pitch + 90) / 180;

			armToState(state);
			// console.log(state);
			if (recording) {
				history.push(state);
			}
		} // maybe add else for blink

	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

}

function toCoords(position, bounds) { // normalizes point with custom bounds
	return { // maybe add scaling function here
		x: 2 * (clamp(position[0], bounds.x.min, bounds.x.max) - bounds.x.min) / (bounds.x.max - bounds.x.min) - 1,
		y: (clamp(position[1], bounds.y.min, bounds.y.max) - bounds.y.min) / (bounds.y.max - bounds.y.min),
		z: 1 - (clamp(position[2], bounds.z.min, bounds.z.max) - bounds.z.min) / (bounds.z.max - bounds.z.min),
	}
}

function clamp(n, min, max) {
	return Math.min(Math.max(n, min), max);
}

var history =  [];

function playHistory() {
	tracking = false;
	for (var i = 0; i < history.length; i++) {
		setTimeout(function(val, end) {
			console.log(history[val]);
			armToState(history[val]); // if use 'i', then it will use i at the value during call time, which will be history.length
			tracking = end;

			if (tracking) {
				playButton.innerHTML = 'play';
			}
			// console.log(i * (1000 / fps));
			// console.log(end);
		}, i * (1000 / fps), i, i >= history.length - 1); // playback speed not exact! try to fix this later
	}
	// console.log(ref.history);
}

function armToState(state) {
	$.post('arm/state', // todo: remove jqueryy dependency
	{
		data: JSON.stringify(state),
		// data: JSON.stringify({'pinch': state['pinch']})
	}
);
}
