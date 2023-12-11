var isMeetingHost = false;
var meetingId = "";
var attendeeId = "";
var userName = "";
var isScreenShared = false;
const attendees = new Set();

var urlParams = new URLSearchParams(window.location.search);
console.log("🚀 ~ file: vid.js:9 ~ urlParams:", urlParams)
console.log("🚀 ~ file: vid.js:9 ~ window.location.search:", window.location.search)

// meetingId will be available if a user tries to join a meeting via a meeting URL
meetingId = urlParams.get("meetingId");
console.log("🚀 ~ file: vid.js:12 ~ meetingId:", meetingId)

const clientId = urlParams.get("clientId")
console.log("🚀 ~ file: vid.js:17 ~ clientId:", clientId)
let requestPath = `http://localhost:3000/api/user/${clientId}/meetings`;

// Setup logger
const logger = new window.ChimeSDK.ConsoleLogger(
	"ChimeMeetingLogs",
	ChimeSDK.LogLevel.INFO
);

const deviceController = new ChimeSDK.DefaultDeviceController(logger);

// If meetingId is not available, then user is the meeting host.
if (!meetingId) {
	isMeetingHost = true;
}

var startButton = document.getElementById("start-button");
var stopButton = document.getElementById("stop-button");
var exitButton = document.getElementById("exit-button");
var shareButton = document.getElementById("share-button");

if (isMeetingHost) {
	startButton.innerText = "Start Meeting";
	stopButton.style.display = "inline-block";
} else {
	startButton.innerText = "Join Meeting";
	exitButton.style.display = "inline-block";
	requestPath += `?meetingId=${meetingId}`;
}

startButton.style.display = "inline-block";
shareButton.style.display = "inline-block";

// Create or Join Meeting
async function doMeeting() {
	userName = document.getElementById("username").value;
	if (userName.length == 0) {
		alert("Please enter username");
		return;
	}

	if (userName.indexOf("#") >= 0) {
		alert("Please do not use special characters in User Name");
		return;
	}

	//If Meeting session already present, return.
	if (window.meetingSession) {
		//alert("Meeting already in progress");
		return;
	}
	try {
		//Send request to service(API Gateway > Lambda function) to start/join meeting.
		console.log("🚀 ~ file: vid.js:72 ~ doMeeting ~ requestPath:", requestPath)
		let reqUrl = requestPath
		// if (meetingId) {
		// 	reqUrl.concat(`?meetingId=${meetingId}`)
		// }
		var response = await fetch(reqUrl, {
			method: "POST",
			headers: new Headers({
				authorization: "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjNhM2JkODk4ZGE1MGE4OWViOWUxY2YwYjdhN2VmZTM1OTNkNDEwNjgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdXBwdGlrLWRldiIsImF1ZCI6InVwcHRpay1kZXYiLCJhdXRoX3RpbWUiOjE3MDE3Nzk1MzAsInVzZXJfaWQiOiJXRlZIYmxDTTFHZ0NIZnlvWUVLZzB4MXJsMVcyIiwic3ViIjoiV0ZWSGJsQ00xR2dDSGZ5b1lFS2cweDFybDFXMiIsImlhdCI6MTcwMTk0NjUzMywiZXhwIjoxNzAxOTUwMTMzLCJwaG9uZV9udW1iZXIiOiIrOTIzMDc4NTE4ODI4IiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJwaG9uZSI6WyIrOTIzMDc4NTE4ODI4Il19LCJzaWduX2luX3Byb3ZpZGVyIjoicGhvbmUifX0.f-vAJ2W6sq3zEFcW_nVhcgI8U_YLadv2poj7jQ0_f41P_bkcTwx87sVOVdbalgOn6CXiuGsO4eYjC4zNxGm8__peVfKNITr6e08FYb-6NaxdUM_LPr4Fr9lh2Qziw9cZo1uzV3lQzz2QW4zM4y58oFGW0vjfla7dSHWszOYiobsuTKcamhbzHj-AjdO3SERLYH0iJh9vuQA0vnctNu2EgUJarjc9OyST5wSwFCCLaKWMVgrlWkGQKVyGDcST91XSa0-Z43kjrGcwH7VIz2l5sxT1RJ62gGR54qzuojUtJQh4q5F8SNYIX5RJKyQwI_zIbGvyyA4mpCZEydLE9T2SPg"
			}),
			body: JSON.stringify({})
		});

		const data = await response.json();

		console.log(data)

		meetingId = data.meeting.MeetingId;
		attendeeId = data.attendee.AttendeeId;

		document.getElementById("meeting-Id").innerText = meetingId;
		if (isMeetingHost) {
			document.getElementById("meeting-link").innerText = window.location.href + "&meetingId=" + meetingId;
		}
		else {
			document.getElementById("meeting-link").innerText = window.location.href;
		}

		const configuration = new ChimeSDK.MeetingSessionConfiguration(
			data.meeting,
			data.attendee
		);
		window.meetingSession = new ChimeSDK.DefaultMeetingSession(
			configuration,
			logger,
			deviceController
		);

		// Initialize Audio Video
		const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
		const videoInputs = await meetingSession.audioVideo.listVideoInputDevices();

		await meetingSession.audioVideo.startAudioInput(audioInputs[0].deviceId);
		await meetingSession.audioVideo.startVideoInput(videoInputs[0].deviceId);

		const observer = {
			// Tile State changed, so let's examine it.
			videoTileDidUpdate: (tileState) => {
				// if no attendeeId bound to tile, ignore it return
				if (!tileState.boundAttendeeId) {
					return;
				}
				//There is an attendee Id against the tile, and it's a valid meeting session, then update tiles view
				if (!(meetingSession === null)) {
					updateTiles(meetingSession);
				}
			},
		};

		const eventObserver = {
			// Check for events of interest for eg. Meeting End.
			eventDidReceive(name, attributes) {
				switch (name) {
					case 'meetingEnded':
						cleanup();
						console.log("NOTE: Meeting Ended", attributes);
						break;
					case 'meetingReconnected':
						console.log('NOTE: Meeting Reconnected...');
						break;
				}
			}
		}

		// Add observers for the meeting session
		meetingSession.audioVideo.addObserver(observer);
		meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence(attendeeObserver);
		meetingSession.eventController.addObserver(eventObserver);

		const audioOutputElement = document.getElementById("meeting-audio");
		meetingSession.audioVideo.bindAudioElement(audioOutputElement);
		meetingSession.audioVideo.start();
		meetingSession.audioVideo.startLocalVideoTile();
	}
	catch (err) {
		console.error("Error: " + err);
	}
}

// Update Video Tiles on UI view
function updateTiles(meetingSession) {
	const tiles = meetingSession.audioVideo.getAllVideoTiles();
	tiles.forEach(tile => {
		let tileId = tile.tileState.tileId
		var divElement = document.getElementById("div-" + tileId);
		// If divElement not found.
		if (!divElement) {
			// Create divElement. Give it a unique id and name
			divElement = document.createElement("div");
			divElement.id = "div-" + + tileId;
			divElement.setAttribute("name", "div-" + tile.tileState.boundAttendeeId);
			divElement.style.display = "inline-block";
			divElement.style.padding = "5px";

			// Create videoElement. Give it a unique id
			videoElement = document.createElement("video");
			videoElement.id = "video-" + tileId;
			videoElement.setAttribute("name", "video-" + tile.tileState.boundAttendeeId);
			videoElement.controls = true;

			// Create 'p' element for user name to display above video tile.
			tileUserName = document.createElement("p");
			tileUserName.style.color = "blueviolet";
			boundExtUserId = tile.tileState.boundExternalUserId
			tileUserName.textContent = boundExtUserId.substring(0, boundExtUserId.indexOf("#"));

			// Append appropriately
			divElement.append(tileUserName);
			divElement.append(videoElement);
			document.getElementById("video-list").append(divElement);

			meetingSession.audioVideo.bindVideoElement(
				tileId,
				videoElement
			);
		}
	})
}

// Attendee presence check
// Update the attendees set and div video tiles display based on this.
function attendeeObserver(attendeeId, present, externalUserId, dropped, posInFrame) {

	//Get Attendee User Name from externalUserId where it was set while joining meeting
	attendeeUserName = externalUserId.substring(0, externalUserId.indexOf("#"));

	// If attendee 'present' is true, add to attendees set.
	if (present) {
		attendees.add(attendeeUserName);
	}
	else {
		// Attendee no longer 'present', remove the attendee display div with video tile
		const elements = document.getElementsByName("div-" + attendeeId);
		elements[0].remove();

		// For screen share attendeeId comes with #content suffix.
		// Do not remove user from attendees if this is screen share closure update
		if (!(attendeeId.indexOf("#content") >= 0)) {
			attendees.delete(attendeeUserName);
		}
	}

	refreshAttendeesDisplay();
};

// Refresh attendee list in UI view
function refreshAttendeesDisplay() {
	//Create list of attendees from attendees set, and then display.
	attendeeStr = "";
	for (const item of attendees) {
		attendeeStr = attendeeStr + item + " | ";
	}
	attendeeStr = attendeeStr.slice(0, -3);

	document.getElementById("Attendees").innerText = attendeeStr;
}

// Stop Meeting		
async function stopMeeting() {
	//Send request to service(API Gateway > Lambda function) to end the Meeting
	try {
		var response = await fetch(requestPath, {
			method: "POST",
			headers: new Headers({
				authorization: "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjNhM2JkODk4ZGE1MGE4OWViOWUxY2YwYjdhN2VmZTM1OTNkNDEwNjgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdXBwdGlrLWRldiIsImF1ZCI6InVwcHRpay1kZXYiLCJhdXRoX3RpbWUiOjE3MDE3Nzk1MzAsInVzZXJfaWQiOiJXRlZIYmxDTTFHZ0NIZnlvWUVLZzB4MXJsMVcyIiwic3ViIjoiV0ZWSGJsQ00xR2dDSGZ5b1lFS2cweDFybDFXMiIsImlhdCI6MTcwMTk0NjUzMywiZXhwIjoxNzAxOTUwMTMzLCJwaG9uZV9udW1iZXIiOiIrOTIzMDc4NTE4ODI4IiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJwaG9uZSI6WyIrOTIzMDc4NTE4ODI4Il19LCJzaWduX2luX3Byb3ZpZGVyIjoicGhvbmUifX0.f-vAJ2W6sq3zEFcW_nVhcgI8U_YLadv2poj7jQ0_f41P_bkcTwx87sVOVdbalgOn6CXiuGsO4eYjC4zNxGm8__peVfKNITr6e08FYb-6NaxdUM_LPr4Fr9lh2Qziw9cZo1uzV3lQzz2QW4zM4y58oFGW0vjfla7dSHWszOYiobsuTKcamhbzHj-AjdO3SERLYH0iJh9vuQA0vnctNu2EgUJarjc9OyST5wSwFCCLaKWMVgrlWkGQKVyGDcST91XSa0-Z43kjrGcwH7VIz2l5sxT1RJ62gGR54qzuojUtJQh4q5F8SNYIX5RJKyQwI_zIbGvyyA4mpCZEydLE9T2SPg"
			}),
			body: JSON.stringify({ action: "END_MEETING", MEETING_ID: `${meetingId}` })
		});

		const data = await response.json();
		console.log("NOTE: END MEETING RESPONSE " + JSON.stringify(data));
		//meetingSession.deviceController.destroy();

		cleanup();
	}
	catch (err) {
		console.error("NOTE Error: " + err);
	}
}

// Leave Meeting
async function exitMeeting() {
	//Send request to service(API Gateway > Lambda function) to delete Attendee Id from meeting.
	try {
		var response = await fetch(requestPath, {
			method: "POST",
			headers: new Headers({
				authorization: "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjNhM2JkODk4ZGE1MGE4OWViOWUxY2YwYjdhN2VmZTM1OTNkNDEwNjgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdXBwdGlrLWRldiIsImF1ZCI6InVwcHRpay1kZXYiLCJhdXRoX3RpbWUiOjE3MDE3Nzk1MzAsInVzZXJfaWQiOiJXRlZIYmxDTTFHZ0NIZnlvWUVLZzB4MXJsMVcyIiwic3ViIjoiV0ZWSGJsQ00xR2dDSGZ5b1lFS2cweDFybDFXMiIsImlhdCI6MTcwMTk0NjUzMywiZXhwIjoxNzAxOTUwMTMzLCJwaG9uZV9udW1iZXIiOiIrOTIzMDc4NTE4ODI4IiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJwaG9uZSI6WyIrOTIzMDc4NTE4ODI4Il19LCJzaWduX2luX3Byb3ZpZGVyIjoicGhvbmUifX0.f-vAJ2W6sq3zEFcW_nVhcgI8U_YLadv2poj7jQ0_f41P_bkcTwx87sVOVdbalgOn6CXiuGsO4eYjC4zNxGm8__peVfKNITr6e08FYb-6NaxdUM_LPr4Fr9lh2Qziw9cZo1uzV3lQzz2QW4zM4y58oFGW0vjfla7dSHWszOYiobsuTKcamhbzHj-AjdO3SERLYH0iJh9vuQA0vnctNu2EgUJarjc9OyST5wSwFCCLaKWMVgrlWkGQKVyGDcST91XSa0-Z43kjrGcwH7VIz2l5sxT1RJ62gGR54qzuojUtJQh4q5F8SNYIX5RJKyQwI_zIbGvyyA4mpCZEydLE9T2SPg"
			}),
			body: JSON.stringify({ action: "DELETE_ATTENDEE", MEETING_ID: `${meetingId}`, ATTENDEE_ID: `${attendeeId}` })
		});

		const data = await response.json();
		console.log("NOTE: END MEETING RESPONSE " + JSON.stringify(data));
		//meetingSession.deviceController.destroy();

		cleanup();
	}
	catch (err) {
		console.error("Error: " + err);
	}
}

// Reset 
function cleanup() {
	meetingSession.deviceController.destroy();
	window.meetingSession = null;
	//if meeting host - don't preserve the meeting id.
	if (isMeetingHost) {
		meetingId = null;
	}
	document.getElementById("video-list").replaceChildren();
	attendees.clear();
	document.getElementById("meeting-link").innerText = "";
	refreshAttendeesDisplay();
}

// Toggle Screen Share
async function share() {
	try {
		if (window.meetingSession) {
			if (isScreenShared) {
				await meetingSession.audioVideo.stopContentShare();
				shareButton.innerText = "Start Screen Share";
				isScreenShared = false;
			}
			else {
				await meetingSession.audioVideo.startContentShareFromScreenCapture();
				shareButton.innerText = "Stop Screen Share";
				isScreenShared = true;
			}
		}
		else {
			alert("Please start or join a meeting first!");
		}
	}
	catch (err) {
		console.error("Error: " + err);
	}
}



window.addEventListener("DOMContentLoaded", () => {

	startButton.addEventListener("click", doMeeting);

	if (isMeetingHost) {
		stopButton.addEventListener("click", stopMeeting);
	}
	else {
		exitButton.addEventListener("click", exitMeeting);
	}

	shareButton.addEventListener("click", share);
});