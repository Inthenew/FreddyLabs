/*
const simulation = globalThis.simulation = new Simulation();
simulation.loadRobot('robot.glb');
document.getElementById('app').remove();

function animate() {
    requestAnimationFrame(animate);
    simulation.update();
}
requestAnimationFrame(animate);
*/

// Speech to Text is a pain so we are going to put a pre-done script: //
const prompt2 = "Pick up the black cube please";
let connectedToServer = false;
let currentAngles = {
    1: 23,
    2: 75,
    3: 90,
    4: 90,
    5: 90,
    6: 90
}
let sttLoaded = false;
let serverArobot = false;
let doingRequest = false;
let stopRequested = false;
let did = false;
// Speech to text stuff //
async function init() {
    if (sttLoaded || did || !connectedToServer) return;
    did = true;
    const serverURL = globalThis.getServerURL();
    //alert('DOWNLOADING');
    const originalFetch = window.fetch;
    window.fetch = (url, options = {}) => {
        options.headers = {
            ...options.headers,
            'ngrok-skip-browser-warning': 'true',
        };
        return originalFetch(url, options);
    };

    const model = await Vosk.createModel('https://www.freddylabs.dev/tests/model2.zip');

    const recognizer = new model.KaldiRecognizer();
    recognizer.on("result", (message) => {
        const text = message.result.text;

        // Global stop command – cancel any ongoing request loop
        if (text.toLowerCase().includes('stop')) {
            stopRequested = true; // signal the running loop to terminate
            return;
        }

        if (serverArobot && !doingRequest) {
            if (text.includes('freddy') || text.includes('freddie')) {
                doingRequest = true;
                window.doCommand(text);
            }
        }
    });
    recognizer.on("partialresult", (message) => {
        if (message.result.partial.length) console.log(`Partial result: ${message.result.partial}`);
    });

    //alert('requesting');
    const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 16000
        },
    });
    //alert('request done');
    const audioContext = new AudioContext();
    const recognizerNode = audioContext.createScriptProcessor(4096, 1, 1)
    recognizerNode.onaudioprocess = (event) => {
        try {
            recognizer.acceptWaveform(event.inputBuffer)
        } catch (error) {
            console.error('acceptWaveform failed', error)
        }
    }
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(recognizerNode);
    recognizerNode.connect(audioContext.destination);
    const sttStatus = document.getElementById('stt-status');
    //alert('SPEECH TO TEXT MODEL LOADED!!');
    sttStatus.textContent = 'Loaded';
    sttStatus.style.color = 'green';
    sttLoaded = true;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const serverIpInput = document.getElementById('server-ip');
    const connectBleButton = document.getElementById('connect-ble-button');
    const connectServerButton = document.getElementById('connect-server-button');
    const getDistanceButton = document.getElementById('get-distance-button');
    const loadSttButton = document.getElementById('load-stt-button');

    const bleStatus = document.getElementById('ble-status');
    const socketStatus = document.getElementById('socket-status');
    const distanceDisplay = document.getElementById('distance-display');

    // --- State ---
    let bleCharacteristic = null;
    let socket = null;

    const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
    const TARGET_DEVICE_NAME_KEYWORDS = ['HM', 'Freddy', 'HC', 'BLE'];

    // --- Helper Functions ---
    const getServerURL = globalThis.getServerURL = () => {
        let serverInput = serverIpInput.value.trim();
        if (!serverInput) return null;
        if (!serverInput.startsWith('http://') && !serverInput.startsWith('https://')) {
            serverInput = 'https://' + serverInput;
        }
        return serverInput;
    }

    // --- Bluetooth Logic ---
    function handleIncomingBle(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);

        console.log('Received BLE data:', text);

        if (text.startsWith('Distance: ')) {
            distanceDisplay.textContent = text.trim();
        }
        else if (text.toLowerCase().includes('nothing in range')) {
            // When nothing is detected, reset the distance display to its placeholder
            distanceDisplay.textContent = 'Distance: -- mm';
        }
    }

    connectBleButton.addEventListener('click', async () => {
        if (bleCharacteristic) {
            // Note: Disconnect logic is complex, for simplicity we don't implement it.
            // A full implementation would require handling device.gatt.disconnect()
            // and cleaning up listeners.
            console.log('Already connected.');
            return;
        }

        try {
            console.log('Requesting Bluetooth device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: TARGET_DEVICE_NAME_KEYWORDS.map(name => ({ namePrefix: name })),
                optionalServices: [UART_SERVICE_UUID]
            });

            console.log('Connecting to GATT Server...');
            const server = await device.gatt.connect();

            console.log('Getting primary service...');
            const service = await server.getPrimaryService(UART_SERVICE_UUID);

            console.log('Getting characteristics...');
            const characteristics = await service.getCharacteristics();

            bleCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
            const notifyCharacteristic = characteristics.find(c => c.properties.notify);

            if (!bleCharacteristic) {
                throw new Error('No writable characteristic found.');
            }

            if (notifyCharacteristic) {
                await notifyCharacteristic.startNotifications();
                notifyCharacteristic.addEventListener('characteristicvaluechanged', handleIncomingBle);
                console.log('Subscribed to notifications.');
            } else {
                console.warn('No notifying characteristic found.');
            }

            device.addEventListener('gattserverdisconnected', () => {
                bleCharacteristic = null;
                bleStatus.textContent = 'Disconnected';
                bleStatus.style.color = 'red';
                getDistanceButton.disabled = true;
                console.log('Robot disconnected.');
            });

            console.log('Bluetooth connected!');
            bleStatus.textContent = 'Connected';
            bleStatus.style.color = 'green';
            getDistanceButton.disabled = false;

            if (connectedToServer) {
                serverArobot = true;
            }

        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            alert('Could not connect to the robot. Please make sure it is on and in range.');
            bleStatus.textContent = 'Error';
            bleStatus.style.color = 'red';
        }
    });

    async function sendBLECommand(cmd, waitMore) {
        if (!bleCharacteristic) {
            alert('Robot is not connected.');
            return;
        }
        try {
            const encoder = new TextEncoder();
            await bleCharacteristic.writeValue(encoder.encode(cmd));
            console.log('Sent command:', cmd);
        } catch (error) {
            console.error(`Failed to send command "${cmd}":`, error);
            alert(`Failed to send command. See console for details.`);
        }

        if (waitMore) await new Promise(r => setTimeout(r, 2000));
    }

    getDistanceButton.addEventListener('click', () => {
        sendBLECommand('%R#');
    });

    loadSttButton.addEventListener('click', () => {
        if (!did) init();
    });

    // --- Socket.IO Logic ---
    connectServerButton.addEventListener('click', async () => {
        const serverURL = getServerURL();
        if (!serverURL) {
            alert('Please enter a server address.');
            return;
        }

        if (socket && socket.connected) {
            console.log('Already connected to server.');
            return;
        }

        console.log('Connecting to server:', serverURL);
        socket = io(serverURL, {
            extraHeaders: {
                'ngrok-skip-browser-warning': 'true'
            }
        });

        socket.on('connect', () => {
            console.log('Connected to server.');
            socketStatus.textContent = 'Connected';
            socketStatus.style.color = 'green';

            connectedToServer = true;
            if (bleCharacteristic) {
                serverArobot = true;
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server.');
            socketStatus.textContent = 'Disconnected';
            socketStatus.style.color = 'red';
        });

        socket.on('connect_error', (error) => {
            console.error('Failed to connect to server:', error);
            alert(`Could not connect to server at ${serverURL}.`);
            socketStatus.textContent = 'Error';
            socketStatus.style.color = 'red';
        });

        socket.on('robot-command', (cmd) => {
            console.log('Received command from server:', cmd);
            sendBLECommand(cmd);
        });
    });

    // --- Media Permissions ---
    let hasMediaPermissions = false;
    let stream = null;
    // Create elements programmatically to avoid HTML dependency
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');

    document.body.appendChild(video);
    document.body.appendChild(canvas);

    // Configure elements
    video.setAttribute('id', 'photo-video');
    video.width = 320;
    video.height = 240;
    video.style.display = 'none';
    video.setAttribute('autoplay', '');

    canvas.setAttribute('id', 'photo-canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.style.display = 'none';

    async function requestMediaPermissions() {
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            tempStream.getTracks().forEach(track => track.stop());
            hasMediaPermissions = true;
        } catch (err) {
            console.error('Permission denied:', err);
            hasMediaPermissions = false;
        }
    }

    async function snapPhoto() {
        if (!hasMediaPermissions) {
            console.warn('Camera permission not granted');
            return null;
        }

        try {
            // Start camera with optimal settings
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment"
                }
            });

            // Attempt to zoom OUT (use the widest field-of-view) if the device/browser supports
            // the MediaTrack "zoom" constraint. This slightly increases the visible scene
            // without affecting resolution.
            try {
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities?.();
                if (capabilities && 'zoom' in capabilities) {
                    const minZoom = capabilities.zoom.min ?? 1; // 1 is typically the widest
                    await track.applyConstraints({ advanced: [{ zoom: minZoom }] });
                    console.log(`Applied hardware zoom level: ${minZoom}`);
                }
            } catch (zoomErr) {
                console.warn('Zoom constraint not supported or failed:', zoomErr);
            }

            video.srcObject = stream;
            video.style.display = 'block';

            // Wait for video to stabilize - use more reliable events for mobile
            await Promise.race([
                new Promise(resolve => {
                    video.onloadedmetadata = resolve;
                    video.play().catch(console.error);
                }),
                new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
            ]);
            // Give camera time to adjust exposure
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get original dimensions
            const originalWidth = video.videoWidth;
            const originalHeight = video.videoHeight;

            // Calculate scaled dimensions (50% of original size)
            const scaleFactor = .5;
            const outputWidth = Math.round(originalWidth * scaleFactor);
            const outputHeight = Math.round(originalHeight * scaleFactor);

            // Set canvas to scaled dimensions
            canvas.width = outputWidth;
            canvas.height = outputHeight;

            // Draw scaled image
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(video,
                0, 0, originalWidth, originalHeight,  // source dimensions
                0, 0, outputWidth, outputHeight       // destination dimensions
            );

            // Apply brightness correction with value clamping
            const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Brighter but clamped to 255
                data[i] = Math.min(255, data[i] * 1.3);     // Red
                data[i + 1] = Math.min(255, data[i + 1] * 1.3); // Green
                data[i + 2] = Math.min(255, data[i + 2] * 1.3); // Blue
            }
            ctx.putImageData(imageData, 0, 0);

            // Convert to JPEG with quality setting for smaller size
            const dataURL = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
            return dataURL.split(',')[1];
        } catch (error) {
            console.error('Photo capture failed:', error);
            return null;
        } finally {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            video.style.display = 'none';
        }
    }
    window.snapPhoto = snapPhoto;

    window.doCommand = async (goal) => {
        if (!socket || !socket.connected) {
            console.error('Not connected to the control server.');
            doingRequest = false;
            return;
        }

        // Helper: parse Gemini response into actionable commands
        function parseCommands(data) {
            const cmds = [];
            if (data.includes('%COMPLETE%')) cmds.push({ command: 'COMPLETE' });
            const regex = /%(\w+)-"(\d*\.?\d+)"/g;
            let match;
            while ((match = regex.exec(data))) {
                cmds.push({ command: match[1], value: parseFloat(match[2]) });
            }
            return cmds;
        }

        // Helper: execute a single parsed command via BLE
        async function executeCommand({ command, value }) {
            if (['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT'].includes(command)) {
                // Map command to single letter
                const commandMap = {
                    'FORWARD': 'F',
                    'BACKWARD': 'B',
                    'LEFT': 'L',
                    'RIGHT': 'R'
                };
                command = commandMap[command];
                // Send motion command then wait the requested duration
                await sendBLECommand(`%${command}#`);
                await new Promise(r => setTimeout(r, value * 1000));
                await sendBLECommand('%T#', true);
            } else {
                let servoNum;
                switch (command) {
                    case 'BASE': servoNum = 1; break;
                    case 'SHOULDER': servoNum = 2; break;
                    case 'ELBOW': servoNum = 3; break;
                    case 'WRIST': servoNum = 4; break;
                    case 'CLAW': servoNum = 6; break;
                }
                if (servoNum) {
                    await sendBLECommand(`%S${servoNum}:${value}#`, true);
                }
            }
        }

        stopRequested = false; // reset stop flag at the beginning of run

        try {
            let completed = false;
            while (!completed && !stopRequested) {
                const foto = await snapPhoto();
                socket.emit('command', goal, foto);

                // Wait for AI response
                const response = await new Promise(resolve => {
                    socket.once('response', resolve);
                });

                console.log('AI response:', response);

                const commands = parseCommands(response);
                completed = commands.some(c => c.command === 'COMPLETE');

                for (const cmdObj of commands) {
                    if (cmdObj.command === 'COMPLETE') break;
                    await executeCommand(cmdObj);
                    if (stopRequested) break; // user interrupted
                }
            }
        } catch (err) {
            console.error('doCommand failed:', err);
        } finally {
            doingRequest = false;
            stopRequested = false; // reset for next session
        }
    }

    // Initialize on load
    requestMediaPermissions();
}); 