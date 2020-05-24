// Global variables
let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;
let isDrawing: boolean = false;
let data: string[] = [];
let imageSize: number = 200;
let pixelSize: number;
let actualCanvasSize: number;
let color: string = "#000000";
let pixelsRemaining = 1000;
let pixelCountDiv: HTMLElement;
let zoom: number = 1;

const ws = new WebSocket('ws://localhost:8080/');
ws.onopen = function() {
    console.log('WebSocket Client Connected');
};
ws.onmessage = function(e) {
	console.log("Received: '" + e.data + "'");
	let dataReceived = JSON.parse(e.data);
	let event = dataReceived.eventType;
	if(event == "pixelsRemainingEvent") {
		pixelsRemaining = dataReceived.pixelsRemaining;
		updatePixelsRemaining();
	} else if(event == "initialImage") {
		data = dataReceived.data;
		repaint();
	} else if(event == "drawPixelEvent") {
		drawPixelAtIndex(dataReceived.index, dataReceived.color);
	}
};
  
function hideOverlay() {
	document.getElementById("overlay").style.display = "none";
	localStorage.name = 'seenmessage';
}  

function init(): void {
	// Initialize a few globals
	canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
	pixelCountDiv = document.getElementById("pixel-remaining-count");
	updatePixelsRemaining();
	context = canvas.getContext("2d");
	adjustCanvasSize();

	// Set event listeners
	canvas.addEventListener("mousedown", onMouseDown);
	canvas.addEventListener("mousemove", onMouseMove)
	window.addEventListener("mouseup", onMouseUp)
	window.onresize = onResize;
	document.getElementById("zoom-in").onclick = onZoomIn;
	document.getElementById("zoom-out").onclick = onZoomOut;

	// Intialize imageData
	for(let i = 0; i < imageSize * imageSize; i++) {
		data.push(getRandomColor());
	}

	// Hide the overlay if the user already saw it
	if(localStorage.name == 'seenmessage') {
		hideOverlay()
	}	

	repaint();
}
init();

function adjustCanvasSize() {
	let width = document.body.clientWidth;
	let height = document.body.clientHeight;

	let smaller = width > height ? height : width;
	pixelSize = ~~(smaller/imageSize);
	pixelSize *= zoom;

	actualCanvasSize = pixelSize * imageSize;
	canvas.width = actualCanvasSize;
	canvas.height = actualCanvasSize;
}

function updatePixelsRemaining() {
	pixelCountDiv.innerHTML = "" + pixelsRemaining;
	if(pixelsRemaining <= 0) {
		pixelCountDiv.innerHTML = "Come back tomorrow for more pixels!";
		pixelCountDiv.style.fontSize = "20px";
		return;
	}
	pixelCountDiv.innerHTML = "" + pixelsRemaining;
	pixelCountDiv.style.fontSize = "60px";
}

function onResize() {
	adjustCanvasSize();
	repaint();
}

let oldX = 0;
let oldY = 0;

function onMouseDown(e: { offsetX: number; offsetY: number; }) {
	isDrawing = true;
	let px = ~~((e.offsetX / actualCanvasSize) * imageSize);
	let py = ~~((e.offsetY / actualCanvasSize) * imageSize);


	drawPixel(px, py);
	oldX = e.offsetX;
	oldY = e.offsetY;
}

function onMouseMove(e: { offsetX: number; offsetY: number; }) {
	if(isDrawing) {
		let steps = 100;
		let dx = e.offsetX - oldX;
		let dy = e.offsetY - oldY;
		oldX = e.offsetX;
		oldY = e.offsetY;    

		for(let i = 0; i < steps; i++) {
			let x = oldX - dx * (i / (steps));
			let y = oldY - dy * (i / (steps));

			let px = ~~((x / actualCanvasSize) * imageSize);
			let py = ~~((y / actualCanvasSize) * imageSize);
		
			drawPixel(px, py);
		}
	}
}

function onMouseUp() {
	isDrawing = false;
}

function drawPixel(x: number, y: number) {
	if(pixelsRemaining <= 0) {
		return;
	}
	if(x > imageSize || y > imageSize) {
		console.error("Tried to draw out of bounds pixel!")
		return;
	}
	let index = (~~x) + (~~y * imageSize);
	if(data[index] === color) {
		return;
	}

	let dataToSend = {
		index: index,
		color: "" + color
	};
	ws.send(JSON.stringify(dataToSend));	

	drawPixelAtIndex(index, color);
}

function drawPixelAtIndex(index: number, color: string) {

	let x = index % imageSize;
	let y = ~~(index / imageSize);

	console.log("Drawing pixel, color: " + color);
	data[index] = color;
	context.fillStyle = color;
	context.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
}

function repaint() {
	if(data.length != imageSize * imageSize) { console.error("Repaint error, image data isn't the right size.") }


	for(let i = 0; i < data.length; i++) {
		let x = i % imageSize;
		let y = ~~(i / imageSize);
		context.fillStyle = data[i];
		context.fillRect(x*pixelSize, y*pixelSize, pixelSize, pixelSize);
	}
}

function componentToHex(c: number) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
	

function getRandomColor(): string {
	let val = 255 - Math.random() * 10;
	let randomColor = rgbToHex(~~val, ~~val ,~~val);
	// console.log(randomColor);
	return randomColor;
}
  
function onZoomIn() {
	zoom *= 2;
	zoom = Math.min(zoom, 16);
	adjustCanvasSize();
	repaint();
}

function onZoomOut() {
	zoom /= 2;
	zoom = Math.max(zoom, (1/4));
	adjustCanvasSize();
	repaint();
}

onResize();



let picker: HTMLElement = document.getElementById("color-picker");

const pickr = Pickr.create({
	el: picker,
	theme: 'nano', // or 'monolith', or 'nano'
	default: "#000000",
	comparison: false,

	swatches: [
		'rgba(244, 67, 54, 1)',
		'rgba(233, 30, 99, 1)',
		'rgba(156, 39, 176, 1)',
		'rgba(103, 58, 183, 1)',
		'rgba(63, 81, 181, 1)',
		'rgba(33, 150, 243, 1)',
		'rgba(3, 169, 244, 1)',
		'rgba(0, 188, 212, 1)',
		'rgba(0, 150, 136, 1)',
		'rgba(76, 175, 80, 1)',
		'rgba(139, 195, 74, 1)',
		'rgba(205, 220, 57, 1)',
		'rgba(255, 235, 59, 1)',
		'rgba(255, 193, 7, 1)'
	],
 
	components: {
 
		// Main components
		preview: true,
		opacity: false,
		hue: true,
 
		// Input / output Options
		interaction: {
			hex: true,
			input: true
		}
	}
});

pickr.on('change', (newColor, instance) => {
	// console.log("new color picked: " + newColor.toHEXA().toString());
	color = newColor.toHEXA();
	(document.getElementsByClassName("pcr-button")[0] as HTMLElement).style.color = newColor;
});