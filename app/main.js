document.addEventListener('DOMContentLoaded', () => {
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
        
        // If empty, return null
        if (!serverInput) {
            return null;
        }
        
        // Add https:// if no protocol specified
        if (!serverInput.startsWith('http://') && !serverInput.startsWith('https://')) {
            serverInput = 'https://' + serverInput;
        }
        
        return serverInput;
    }

    function validateServerInput() {
        const serverURL = getServerURL();
        if (!serverURL) {
            alert('Please enter a server address.');
            return false;
        }
        return true;
    }

    // --- UI Logic ---
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // --- Bluetooth Logic ---
    connectBleButton.addEventListener('click', async () => {
        // Validate server input first
        if (!validateServerInput()) {
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
            const service = await server.getPrimaryService(UART_SERVICE_UUID);
            bleCharacteristic = await service.getCharacteristic(UART_CHAR_UUID);
            
            console.log('Bluetooth connected!');
            connectBleButton.textContent = 'Connected!';
            connectBleButton.disabled = true;
            setupButton.disabled = false;
            
            // Disable server input once connected
            serverIpInput.disabled = true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            alert('Could not connect to the robot. Please make sure it is on and in range.');
        }
    });

    async function sendBLECommand(cmd) {
        if (!bleCharacteristic) {
            console.warn('BLE characteristic not available.');
            return;
        }
        try {
            const encoder = new TextEncoder();
            await bleCharacteristic.writeValueWithoutResponse(encoder.encode(cmd));
            console.log('Sent BLE command:', cmd);
        } catch (error) {
            console.error('Failed to write BLE command:', error);
        }
    }

    // --- Camera & Socket.IO Logic ---
    async function startCalibration() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            await video.play();
            
            // Set canvas size once video is playing
            video.addEventListener('playing', () => {
                 canvas.width = video.videoWidth;
                 canvas.height = video.videoHeight;
            }, { once: true });

            setupSocket();
        } catch (error) {
            console.error('Camera setup failed:', error);
            alert('Could not access camera. Please grant permission and try again.');
            resetToHome();
        }
    }

    function captureFrame() {
        if (!video.srcObject) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Return base64 data, stripping the data URL prefix
        return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
    }

    function setupSocket() {
        const serverURL = getServerURL();
        if (!serverURL) {
            alert('Invalid server URL');
            resetToHome();
            return;
        }

        console.log('Connecting to server:', serverURL);
        socket = io(serverURL);

        socket.on('connect', () => console.log('Connected to server.'));
        socket.on('disconnect', () => console.log('Disconnected from server.'));

        socket.on('connect_error', (error) => {
            console.error('Failed to connect to server:', error);
            alert(`Could not connect to server at ${serverURL}. Please check the address and try again.`);
            resetToHome();
        });

        socket.on('request-frame', () => {
            const frame = captureFrame();
            if (frame) {
                socket.emit('video-frame', frame);
            }
        });

        socket.on('robot-command', (cmd) => {
            sendBLECommand(cmd);
        });

        socket.on('stop-streaming', () => {
            console.log('Received stop signal.');
            stopCalibration();
            showScreen('finished');
        });
    }
    
    function stopCalibration() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    // --- Main Flow ---
    setupButton.addEventListener('click', () => {
        showScreen('countdown');
        let count = 30;
        countdownText.textContent = `Calibrating in ${count}...`;
        countdownInterval = setInterval(() => {
            count--;
            countdownText.textContent = `Calibrating in ${count}...`;
            if (count <= 0) {
                clearInterval(countdownInterval);
                showScreen('calibrating');
                startCalibration();
            }
        }, 1000);
    });
    
    function resetToHome() {
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