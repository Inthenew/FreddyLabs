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
    1: 0,
    2: 75,
    3: 90,
    4: 90,
    5: 90,
    6: 90
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const serverIpInput = document.getElementById('server-ip');
    const connectBleButton = document.getElementById('connect-ble-button');
    const connectServerButton = document.getElementById('connect-server-button');
    const getDistanceButton = document.getElementById('get-distance-button');

    const bleStatus = document.getElementById('ble-status');
    const socketStatus = document.getElementById('socket-status');
    const distanceDisplay = document.getElementById('distance-display');

    // --- State ---
    let bleCharacteristic = null;
    let socket = null;

    // --- Whisper ASR (Transformers.js) ---
    let transcriber = null;
    let whisperReady = false;

    const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
    const TARGET_DEVICE_NAME_KEYWORDS = ['HM', 'Freddy', 'HC', 'BLE'];

    // --- Helper Functions ---
    function getServerURL() {
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
                startPickUp();
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

    // --- Socket.IO Logic ---
    connectServerButton.addEventListener('click', () => {
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
        socket = io(serverURL);

        socket.on('connect', () => {
            console.log('Connected to server.');
            socketStatus.textContent = 'Connected';
            socketStatus.style.color = 'green';

            connectedToServer = true;
            if (bleCharacteristic) {
                startPickUp();
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
            const scaleFactor = 0.5;
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

    function startPickUp() {
        alert('You have 20 seconds to put your phone on the stand!!');
        setTimeout(async () => {
            let alreadyMoved = false;
            function extractCoords(noPrompt) {
                return new Promise(async (res, rej) => {
                    const foto = await snapPhoto();

                    // Ask for all the data we need //
                    socket.emit('command', prompt2, foto, !!noPrompt);

                    socket.once('doNext', async (coordX, coordY, cCoords) => {
                        if (coordY === 'FAILURE') {
                            alert('There was an issue!!');
                            res('FAILURE');
                        } else if (coordY === 'DELAY') {
                            // Move the claw down!! //
                            await sendBLECommand('%S1:0#', true);

                            await sendBLECommand('%S2:100#', true);

                            // Repair #1: Claw never gets in view //
                            await sendBLECommand('%S3:70#', true);

                            if (alreadyMoved) {
                                alert("We can't find the claw!!");
                                res('FAILURE');
                                return;
                            }
                            alreadyMoved = true;
                            const handleAgain = await extractCoords(noPrompt);
                            res(handleAgain);
                        } else {
                            if (noPrompt) cCoords = coordX;
                            let clawCoords = cCoords.split(',');
                            const clawCoordX = Number(clawCoords[0]);
                            const clawCoordY = Number(clawCoords[1]);
                            // 618 562 257 283 // (Example) //
                            if (!noPrompt) {
                                res([coordX, coordY, clawCoordX, clawCoordY]);
                            } else {
                                res([clawCoordX, clawCoordY]);
                            }
                        }
                    })
                })
            }

            // Might need to be tweaked, untested. If you do, edit the other area where this is done as well. //
            await sendBLECommand('%S1:0#', true);
            await sendBLECommand('%S2:100#', true);
            await sendBLECommand('%S3:70#', true);
            let coords = await extractCoords();
            let ratio = -.05;
            const pixelXDistance = coords[0] - coords[2];
            console.log('Initial coordinates:', coords);
            console.log('Initial pixel X distance:', pixelXDistance);
            socket.emit('LOG-THIS-PLEASE', `just moved 3 tings. Pixel distance=${pixelXDistance}`)

            let currentBaseROT = currentAngles[1];
            const initialBaseROT = currentBaseROT;
            console.log('Current base rotation:', currentBaseROT);
            socket.emit('LOG-THIS-PLEASE', 'Current base rotation=' + currentBaseROT)

            let changeAmount = Math.round(pixelXDistance * ratio);
            console.log('Change amount:', changeAmount);
            socket.emit('LOG-THIS-PLEASE', 'Change amount=' + changeAmount)

            // Make sure it doesn't start by trying to go above 0 (that would be retarted abnd result in no ratio) //
            if ((currentBaseROT + changeAmount) < 0) {
                currentBaseROT -= changeAmount;
            } else currentBaseROT += changeAmount;
            currentBaseROT = Math.max(Math.min(180, currentBaseROT), 0);
            console.log('New base rotation after first adjustment:', currentBaseROT);

            // Update the base rot //
            currentAngles[1] = currentBaseROT;

            await sendBLECommand(`%S1:${currentBaseROT}#`, true);
            socket.emit('LOG-THIS-PLEASE', 'Moved arm sideways, now its ' + currentBaseROT);

            // SECOND ROUND //
            const newCoords = await extractCoords(true);
            console.log('New coordinates after first adjustment:', newCoords);
            socket.emit('LOG-THIS-PLEASE', 'NEW CORDS AFTER STIZUF (second round start):' + newCoords);

            if (newCoords === 'FAILURE' || !Array.isArray(newCoords) || newCoords.length < 2 || isNaN(newCoords[0])) {
                alert('Failed to get claw coordinates (second round)!!');
                socket.emit('LOG-THIS-PLEASE', 'OMG OMG FAIL FAIL FAIL BOZO');
                return;
            }

            const newPixelXDistance = coords[0] - newCoords[0];
            console.log('New pixel X distance:', newPixelXDistance);
            socket.emit('LOG-THIS-PLEASE', 'new pixel dis ' + newPixelXDistance);

            // Calculate how much the claw actually moved in pixels //
            const initialClawX = coords[2];//483
            const newClawX = newCoords[0];//437
            const actualPixelMovement = newClawX - initialClawX; //-46

            const actualDegreesChange = currentBaseROT - initialBaseROT; // 3

            if (actualPixelMovement === 0 || actualDegreesChange === 0) {
                // Not alert cause not that important //
                alert('No measurable movement - aborting refinement');
                socket.emit('LOG-THIS-PLEASE', 'OMG OMG NO MEASURABLE MOVEMENT, HERE INFO ' + actualPixelMovement + ' ' + actualDegreesChange);
                return;
            }

            // Real (signed) degrees-per-pixel coefficient
            const degPerPixel = actualDegreesChange / actualPixelMovement;//-0.0652173913

            // Pixels we still have to close (signed)
            const remainingPixelGap = coords[0] - newClawX;//415 - 437 (-22)
            console.log('Remaining pixel gap:', remainingPixelGap);

            // How many more servo degrees we need (signed)
            let requiredDegChange = remainingPixelGap * degPerPixel;//=1.43478261, shoulda been 19

            // Apply *one* mathematically determined correction
            currentBaseROT += requiredDegChange;
            currentBaseROT = Math.max(Math.min(180, currentBaseROT), 0);
            console.log('Corrected base rotation:', currentBaseROT);
            currentAngles[1] = currentBaseROT;
            socket.emit('LOG-THIS-PLEASE', 'Second round sideways movement result ' + currentBaseROT + '. Pixel gap was ' + remainingPixelGap);

            await sendBLECommand(`%S1:${currentBaseROT}#`, true);
            socket.emit('LOG-THIS-PLEASE', 'sent it');
            // VERTICAL MOVEMENT //

            // 1. Open gripper //
            await sendBLECommand('%S6:0#', true);
            socket.emit('LOG-THIS-PLEASE', 'GRIPPER OPEN. VERTICAL MOVEMENT STARTED');

            // 2. First movement //
            const initialVertGap = coords[1] - coords[3]; // objectY - clawY
            console.log('Initial vertical pixel gap:', initialVertGap);

            let currentShoulderROT = currentAngles[2];
            const initialShoulderROT = currentShoulderROT;

            // Heuristic move (mirrors base-axis pattern)
            let vertRatio = -0.05; // tuned sign so positive gap -> negative deg change
            let vertChange = Math.round(initialVertGap * vertRatio);

            if ((currentShoulderROT + vertChange) < 0) {
                currentShoulderROT -= vertChange;
            } else {
                currentShoulderROT += vertChange;
            }
            currentShoulderROT = Math.max(Math.min(180, currentShoulderROT), 0);
            currentAngles[2] = currentShoulderROT;
            socket.emit('LOG-THIS-PLEASE', `ROUND 1 INFO!! result for s2 is ${currentShoulderROT}. Pixel gap was ${initialVertGap}`);
            await sendBLECommand(`%S2:${currentShoulderROT}#`, true);
            socket.emit('LOG-THIS-PLEASE', 'DID IT');
            // 3. Second movement //
            const newVertCoords = await extractCoords(true);
            socket.emit('LOG-THIS-PLEASE', 'Extracted new vert coords');
            if (newVertCoords !== 'FAILURE' && Array.isArray(newVertCoords)) {
                const newClawY = newVertCoords[3] ?? newVertCoords[1]; // clawY after move
                const actualPixelVertMove = newClawY - coords[3];
                const actualShoulderDegChange = currentShoulderROT - initialShoulderROT;

                if (actualPixelVertMove !== 0 && actualShoulderDegChange !== 0) {
                    const degPerPixelVert = actualShoulderDegChange / actualPixelVertMove;
                    const remainingVertGap = coords[1] - newClawY;
                    let requiredVertDeg = remainingVertGap * degPerPixelVert;

                    if ((currentShoulderROT + requiredVertDeg) < 0) {
                        currentShoulderROT -= requiredVertDeg;
                    } else {
                        currentShoulderROT += requiredVertDeg;
                    }
                    currentShoulderROT = Math.max(Math.min(180, currentShoulderROT), 0);
                    currentAngles[2] = currentShoulderROT;
                    socket.emit('LOG-THIS-PLEASE', 'ROUND 2 CALCULATED ' + currentShoulderROT + '. PIXEL: ' + remainingVertGap);
                    await sendBLECommand(`%S2:${currentShoulderROT}#`, true);
                    socket.emit('LOG-THIS-PLEASE', 'sent');
                }
            }

            // Wait a sec //
            socket.emit('LOG-THIS-PLEASE', 'waiting');
            await new Promise(r => setTimeout(r, 500));
            socket.emit('LOG-THIS-PLEASE', 'waited');

            // Close the gripper //
            await sendBLECommand('%S6:95#', true);
            socket.emit('LOG-THIS-PLEASE', 'close claw');
        }, 20 * 1000)
    }

    // Initialize on load
    requestMediaPermissions();
}); 