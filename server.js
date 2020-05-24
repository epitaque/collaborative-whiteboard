// Requires
var express = require('express');
var app = express();
var fs = require("fs");
var PNG = require("pngjs").PNG;
var path = require('path');
var serveIndex = require('serve-index')
var cron = require('node-cron');
const WebSocket = require('ws')
_ = require('underscore');

// Globals
var initialPixels = 1000;
var imageSize = 200;
var port = 3000;
var pixelsRemaining = new Map();
var data = [];
var wss = new WebSocket.Server({ port: 8080 })
var changesSinceLastWrite = false;

// Cron job to give people their pixels back, at 00:00 and 12:00
cron.schedule('00 00,12 * * *', () => {
	console.log('Giving everyone pixels again! Hooray!');
	for(let key of pixelsRemaining.keys()) {
		pixelsRemaining.set(key, initialPixels);
	}
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			let dataToSend = {
				eventType: "pixelsRemainingEvent",
				pixelsRemaining: pixelsRemaining.get(client.epiip)
			}
			client.send(JSON.stringify(dataToSend));
		}
	});
});

// Cron job to save the image if there were changes, every 15 minutes
cron.schedule('0,15,30,45 * * * *', () => {
	if(!changesSinceLastWrite) { return; }
	changesSinceLastWrite = false;

	savePicture();

});

process.on('SIGINT', function() {
	console.log("Doing graceful shutdown..." + changesSinceLastWrite);
	if(changesSinceLastWrite) {
		savePicture(() => {
			process.exit();
		});
	}
});  

function savePicture(doneCb) {
	let newfile = new PNG({ width: imageSize, height: imageSize });

	for (let y = 0; y < newfile.height; y++) {
		for (let x = 0; x < newfile.width; x++) {
			let index = (newfile.width * y + x) << 2;
			let color = hexToRgb(data[index >> 2]);

			newfile.data[index] = color.r;
			newfile.data[index + 1] = color.g;
			newfile.data[index + 2] = color.b;
			newfile.data[index + 3] = 0xff;
		}
	}

	var now = new Date();
	let name = "Drawing-" + now.getFullYear() + "-" + now.getMonth() + now.getDate() + "-" + now.getHours() + "-" + now.getMinutes() + ".png";

	newfile
		.pack()
		.pipe(fs.createWriteStream(__dirname + "/images/" + name))
		.on("finish", function () {
			console.log("Wrote file " + name);
			if(doneCb) {
				doneCb();
			}
		});
}


wss.on('connection', (ws, req) => {
	var ip  =  req.connection.remoteAddress;
	ws.epiip = ip;
	console.info("Client connected: " + ip);
	if(!pixelsRemaining.has(ip)) {
		pixelsRemaining.set(ip, initialPixels);
	}

	ws.on('message', message => {
		console.log("Received draw pixel message: " + message);

		let msg = JSON.parse(message);
		let index = msg.index;
		let color = msg.color; 
		drawPixel(ip, index, color, ws);
	})

	let dataToSend = {
		eventType: "pixelsRemainingEvent",
		pixelsRemaining: pixelsRemaining.get(ip)
	}
	ws.send(JSON.stringify(dataToSend));

	dataToSend = {
		eventType: "initialImage",
		data: data
	}

	ws.send(JSON.stringify(dataToSend));
})

function drawPixel(ip, index, color, ws) {
	let pixelsLeft = pixelsRemaining.get(ip);
	let dataToSend = {
		eventType: "pixelsRemainingEvent",
		pixelsRemaining: pixelsRemaining.get(ip)
	}
	ws.send(JSON.stringify(dataToSend));


	if(pixelsLeft <= 0) {
		console.log("No pixels left for ip " + ip + "!");
		return;
	}

	changesSinceLastWrite = true;
	pixelsRemaining.set(ip, pixelsRemaining.get(ip) - 1);
	data[index] = color;

	wss.clients.forEach(function each(client) {
		if (client !== ws && client.readyState === WebSocket.OPEN) {
			let dataToSend = {
				eventType: "drawPixelEvent",
				index: index,
				color: "" + color
			}
			client.send(JSON.stringify(dataToSend));
		}
	  });
}

function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
	  r: parseInt(result[1], 16),
	  g: parseInt(result[2], 16),
	  b: parseInt(result[3], 16)
	} : null;
  }
    

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


function init() {
	function getMostRecentFileName(dir) {
		var files = fs.readdirSync(dir);

		return _.max(files, function (f) {
			var fullpath = path.join(dir, f);

			return fs.statSync(fullpath).ctime;
		});
	}

	let imagesDir = "./images/";
	let mostRecentFile = getMostRecentFileName(imagesDir);
	console.log("Most recent file: " + imagesDir + mostRecentFile);

	fs.createReadStream(imagesDir + mostRecentFile)
		.pipe(
		new PNG({
			filterType: 4,
		}))
		.on("parsed", function () {
		for (var y = 0; y < this.height; y++) {
			for (var x = 0; x < this.width; x++) {
				var idx = (this.width * y + x) << 2;
				data.push(rgbToHex(this.data[idx], this.data[idx + 1], this.data[idx + 2]));
			}
		}

		// this.pack().pipe(fs.createWriteStream("out.png"));
	});
}
init();

app.use("/images", express.static(__dirname + '/images'));
app.use("/images", serveIndex(__dirname + '/images'));

app.use(express.static('public'));

app.listen(port, function () { 
	return console.log("Drawing app listening at http://localhost:" + port); 
});
