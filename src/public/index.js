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
var fps = 30;

window.onload = function() {
	useLeapMotion();
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
		if (frame.hands.length > 0) {
			var hand = frame.hands[0];
			// var box = frame.interactionBox;
			// var pos = toCoords(box.normalizePoint(hand.palmPosition, true));
			var state = {};

			var pos = toCoords(hand.palmPosition, leapBounds);
			state['x'] = pos.x;
			state['y'] = pos.y;
			state['z'] = pos.z;
			state['pinch'] = hand.pinchStrength;

			var roll = radToDeg(hand.roll()); // -90: facing left, 90: facing right
			var pitch = radToDeg(hand.pitch()); // -90: down, 90: up

			state['roll'] = (roll + 90) / 180;
			state['pitch'] = (pitch + 90) / 180;

			$.post('arm/state', // todo: remove jqueryy dependency
			{
					data: JSON.stringify(state),
					// data: JSON.stringify({'pinch': state['pinch']})
				}
			);
			console.log(state);
		}
		else {
			// todo: add back blink feature
		}
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
