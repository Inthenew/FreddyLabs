document.addEventListener('DOMContentLoaded', () => {
    alert('DOM content loaded. Initializing script.');

    // --- DOM Elements ---
    const screens = {
        instructions: document.getElementById('instructions-screen'),
        countdown: document.getElementById('countdown-screen'),
        calibrating: document.getElementById('calibrating-screen'),
        finished: document.getElementById('finished-screen'),
    };
    const connectBleButton = document.getElementById('connect-ble-button');
    const setupButton = document.getElementById('setup-button');
    const finishButton = document.getElementById('finish-button');
    const backButtons = [document.getElementById('back-button'), document.getElementById('finish-back-button')];
    const countdownText = document.getElementById('countdown-text');
    const video = document.getElementById('camera-view');
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d');
    const serverIpInput = document.getElementById('server-ip');

    // --- State ---
    let bleCharacteristic = null;
    let socket = null;
    let countdownInterval = null;
    let stream = null;
    
    const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Standard BLE UART service
    const UART_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';    // Standard BLE UART characteristic
    const TARGET_DEVICE_NAME_KEYWORDS = ['HM', 'Freddy', 'HC', 'BLE']; // Keywords for robot's BLE name

    // --- Helper Functions ---
    function getServerURL() {
        let serverInput = serverIpInput.value.trim();
        alert(`getServerURL called. Raw input: "${serverInput}"`);
        
        if (!serverInput) {
            alert('Server input is empty.');
            return null;
        }
        
        if (!serverInput.startsWith('http://') && !serverInput.startsWith('https://')) {
            alert('Protocol not found, adding https://');
            serverInput = 'https://' + serverInput;
        }
        
        alert(`Formatted server URL: ${serverInput}`);
        return serverInput;
    }

    function validateServerInput() {
        alert('Validating server input...');
        const serverURL = getServerURL();
        if (!serverURL) {
            alert('Validation failed: Server URL is empty.');
            return false;
        }
        alert('Validation successful.');
        return true;
    }

    // --- UI Logic ---
    function showScreen(screenName) {
        alert(`Showing screen: ${screenName}`);
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // --- Bluetooth Logic ---
    connectBleButton.addEventListener('click', async () => {
        alert('Connect to Robot button clicked.');
        
        if (!validateServerInput()) {
            alert('Server input validation failed. Aborting connection.');
            return;
        }

        try {
            alert('Requesting Bluetooth device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: TARGET_DEVICE_NAME_KEYWORDS.map(name => ({ namePrefix: name })),
                optionalServices: [UART_SERVICE_UUID]
            });
            alert(`Device found: ${device.name}`);

            alert('Connecting to GATT Server...');
            const server = await device.gatt.connect();
            alert('GATT Server connected.');

            alert(`Getting primary service: ${UART_SERVICE_UUID}`);
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            alert('Primary service obtained.');
            
            alert(`Getting characteristic: ${UART_CHAR_UUID}`);
            bleCharacteristic = await service.getCharacteristic(UART_CHAR_UUID);
            alert('BLE characteristic obtained.');
            
            alert('Bluetooth connected successfully!');
            connectBleButton.textContent = 'Connected!';
            connectBleButton.disabled = true;
            setupButton.disabled = false;
            serverIpInput.disabled = true;
        } catch (error) {
            alert(`Bluetooth connection failed: ${error.message}`);
        }
    });

    async function sendBLECommand(cmd) {
        alert(`Attempting to send BLE command: ${cmd}`);
        if (!bleCharacteristic) {
            alert('Cannot send command: BLE characteristic not available.');
            return;
        }
        try {
            alert('Encoding command...');
            const encoder = new TextEncoder();
            const data = encoder.encode(cmd);
            alert('Sending data to device...');
            await bleCharacteristic.writeValue(data);
            alert(`Successfully sent BLE command: ${cmd}`);
        } catch (error) {
            alert(`Failed to write BLE command: ${error.message}`);
        }
    }

    // --- Camera & Socket.IO Logic ---
    async function startCalibration() {
        alert('Starting calibration process...');
        try {
            alert('Requesting camera access (getUserMedia)...');
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            await video.play();
            alert('Camera stream active.');
            
            video.addEventListener('playing', () => {
                 alert('Video is playing, setting canvas size.');
                 canvas.width = video.videoWidth;
                 canvas.height = video.videoHeight;
            }, { once: true });

            alert('Setting up socket connection...');
            setupSocket();
        } catch (error) {
            alert(`Camera setup failed: ${error.message}`);
            resetToHome();
        }
    }

    function captureFrame() {
        alert('Capturing frame...');
        if (!video.srcObject) {
            alert('Cannot capture frame, video stream is not active.');
            return null;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        alert('Frame captured and converted to base64.');
        return frameData;
    }

    function setupSocket() {
        const serverURL = getServerURL();
        if (!serverURL) {
            alert('Cannot setup socket: Invalid server URL.');
            resetToHome();
            return;
        }

        alert(`Connecting to server via Socket.IO: ${serverURL}`);
        socket = io(serverURL);

        socket.on('connect', () => alert('Socket.IO: Connected to server.'));
        socket.on('disconnect', () => alert('Socket.IO: Disconnected from server.'));

        socket.on('connect_error', (error) => {
            alert(`Socket.IO: Connection Error: ${error.message}`);
            resetToHome();
        });

        socket.on('request-frame', () => {
            alert('Socket.IO: Received "request-frame" from server.');
            const frame = captureFrame();
            if (frame) {
                alert('Socket.IO: Emitting "video-frame" to server.');
                socket.emit('video-frame', frame);
            }
        });

        socket.on('robot-command', (cmd) => {
            alert(`Socket.IO: Received "robot-command" from server: ${cmd}`);
            sendBLECommand(cmd);
        });

        socket.on('stop-streaming', () => {
            alert('Socket.IO: Received "stop-streaming" from server.');
            stopCalibration();
            showScreen('finished');
        });
    }
    
    function stopCalibration() {
        alert('Stopping calibration...');
        if (stream) {
            alert('Stopping camera stream.');
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (socket) {
            alert('Disconnecting socket.');
            socket.disconnect();
            socket = null;
        }
        if (countdownInterval) {
            alert('Clearing countdown interval.');
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        alert('Calibration stopped.');
    }

    // --- Main Flow ---
    setupButton.addEventListener('click', () => {
        alert('Setup button clicked.');
        showScreen('countdown');
        let count = 30;
        countdownText.textContent = `Calibrating in ${count}...`;
        countdownInterval = setInterval(() => {
            count--;
            countdownText.textContent = `Calibrating in ${count}...`;
            if (count <= 0) {
                alert('Countdown finished. Starting calibration.');
                clearInterval(countdownInterval);
                showScreen('calibrating');
                startCalibration();
            }
        }, 1000);
    });
    
    function resetToHome() {
        alert('Resetting to home screen.');
        stopCalibration();
        showScreen('instructions');
        setupButton.disabled = true;
        connectBleButton.disabled = false;
        connectBleButton.textContent = '1. Connect to Robot';
        serverIpInput.disabled = false;
    }

    finishButton.addEventListener('click', resetToHome);
    backButtons.forEach(btn => btn.addEventListener('click', resetToHome));

    // --- Initial State ---
    showScreen('instructions');
}); 