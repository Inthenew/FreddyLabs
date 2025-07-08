// NOTES:
// replace the robot.glb with the glitch url when you have the chance //
// Follow the todos when finished (!!) //

class Simulation {
    constructor() {
        // Set up everything //
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        // To be removed (hide the gui) //
        document.body.appendChild(this.renderer.domElement);
        this.scene.background = new THREE.Color('skyblue');
        this.sampleCameraData = null;
        this.sample2CameraData = null;
        this.realCameraData = null;
        this.robotStructure = {
            wheels: [],
            L298Ns: [],
            motorJoints: [],
            regs: [],
            phoneSlider: null
        }
        this.stuffForJoints = [];
        this.jointDirs = {
            1: 'y',
            2: 'x',
            3: 'x',
            4: 'z',
            5: 'x',
            6: 'y'
        }

        this.startingAngles = {
            1: 23,
            2: 75,
            3: 90,
            4: 90,
            5: 90,
            6: 90
        }

        this.jointStarts = {
            1: 0,
            2: -33,
            3: 9,
            4: -81,
            5: -95,
            6: 65
        }

        this.jointDirections = {
            1: 1,
            2: 1,
            3: -1,
            4: 1,
            5: 1,
            6: -1
        }

        this.loader = new THREE.GLTFLoader();
        //this.loadRobot('robot.glb');

        this.camera.position.z = 1000;
        this.camera.position.y = 250;

        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    async loadRobot(url) {
        return new Promise((res, rej) => {
            this.loader.load(url, async (gltf) => {
                gltf.scene.traverse((node) => {
                    node.material = new THREE.MeshNormalMaterial();

                    if (Number(node.userData.jointNumber) > 4 || (node.parent && Number(node.parent.userData.jointNumber) > 4) || (node.parent && node.parent.parent && Number(node.parent.parent.userData.jointNumber) > 4)) {
                        node.material = new THREE.MeshBasicMaterial({ color: 'black' });
                    }

                    if (node.name.includes('camera')) {
                        // TODO: //
                        // Change to the dimentions of the true camera //
                        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                        camera.position.copy(node.position);
                        // One in the center //
                        if (node.name === 'camera') {
                            camera.position.y += 20;
                            this.sampleCameraData = camera;
                        } else if (node.name === 'samplecamera') {
                            // THe one NOT in the center //
                            this.sample2CameraData = camera;
                            const realCamera = camera.clone();
                            // No cube at the realcamera yet; well do it WHEN WE GET A POSITION //
                            this.realCameraData = realCamera;
                            camera.position.x -= 100;
                            camera.position.y += 20;
                            // Add a blue cube at the camera position //
                            let cubeMesh = new THREE.Mesh(
                                new THREE.BoxGeometry(20, 20, 20),
                                new THREE.MeshBasicMaterial({ color: 'blue' })
                            );
                            cubeMesh.position.copy(camera.position);
                            this.scene.add(cubeMesh);
                        }
                    }

                    if (node.name.includes('joint')) {
                        this.robotStructure.motorJoints.push({
                            node,
                            jointNumber: Number(node.name.split('joint')[1])
                        });
                    }

                    if (node.userData.jointNumber) {
                        this.stuffForJoints.push({
                            node,
                            jointNumber: Number(node.userData.jointNumber)
                        });
                    }

                })

                this.scene.add(gltf.scene);
                this.robotBody = gltf.scene;

                this.freddyBOT = new FreddyBOT(this);
                this.freddyBOT.setUp();

                // Set initial joint positions to starting values //
                for (let i = 1; i <= 6; i++) {
                    const joint = this.robotStructure.motorJoints.find(j => j.jointNumber === i);
                    if (joint) {
                        const axis = this.jointDirs[i];
                        joint.joint.rotation[axis] = this.toRadians(this.jointStarts[i] + (this.startingAngles[i] * this.jointDirections[i]));
                    }
                }

                this.freddyBOT.snapPhoto(this.sampleCameraData, this.getLookAt(this.sampleCameraData));
                res();
            })
        })
    }
    getLookAt(cam) {
        return { lookAt: new THREE.Vector3(cam.position.x, cam.position.y, 5000) };
    }

    update() {
        this.renderer.render(this.scene, this.camera);
        this.controls.update();
    }
}

class FreddyBOT {
    constructor(sim) {
        this.stuff = sim.robotStructure;

        this.sim = sim;
    }

    setUp() {
        this.stuff.motorJoints.sort((a, b) => a.jointNumber - b.jointNumber);
        for (let i = 0; i < this.stuff.motorJoints.length; i++) {
            let joint = this.stuff.motorJoints[i];
            let numbaWhats = this.sim.stuffForJoints.filter(item => item.jointNumber === joint.jointNumber);
            // A lot of this is manual in the code //
            const joint2 = new THREE.Object3D();
            const jointPosition = new THREE.Vector3();
            joint.node.getWorldPosition(jointPosition);
            joint2.position.copy(jointPosition);

            // Add the "numbaWhats" to the joint //
            numbaWhats.forEach(item => {
                joint2.add(item.node);
                item.node.position.sub(jointPosition);
                // Physics bodies for these meshes were already created during model loading.
            });


            // Also add other joints to this joint //
            if (joint.jointNumber !== 1) {
                for (let otherJoint of this.stuff.motorJoints) {
                    if (otherJoint.jointNumber === joint.jointNumber - 1) {
                        const otherJointPosition = new THREE.Vector3();
                        otherJoint.joint.getWorldPosition(otherJointPosition);
                        joint2.position.sub(otherJointPosition);
                        otherJoint.joint.add(joint2);
                    }
                }
            } else {
                this.sim.robotBody.add(joint2);
            }
            this.stuff.motorJoints[i].joint = joint2;
        }
    }

    // I think this is 0 to 360, not offsetted? //
    setJointAngle(jointNumber, angle) {
        const joint = this.stuff.motorJoints.find(j => j.jointNumber === jointNumber);
        if (joint) {
            const direction = this.sim.jointDirections[jointNumber];
            joint.joint.rotation[this.sim.jointDirs[jointNumber]] = this.sim.toRadians(this.sim.jointStarts[jointNumber] + (angle * direction));
        }
    }

    // NEW: Gather information from the real-world device camera (when permissions allow).
    // Values we can NOT get are clearly marked as guesses so that future devs know what to replace.
    async getIRLCameraData() {
        if (this._cachedCameraInfo) return this._cachedCameraInfo;

        const defaultInfo = {
            width: 640,      // Fallback width (pixels)
            height: 480,     // Fallback height (pixels)
            fov: 60          // GUESS: typical smartphone rear-camera FOV (degrees) – browsers don't expose this (thanks Apple!)
        };

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('MediaDevices API not available – using guessed camera parameters.');
            this._cachedCameraInfo = defaultInfo;
            return defaultInfo;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();

            if (settings.width) defaultInfo.width = settings.width;
            if (settings.height) defaultInfo.height = settings.height;
            // No reliable browser API for focal length / FOV – keeping guessed value above.

            // Stop the camera to free resources.
            track.stop();
        } catch (err) {
            console.warn('Could not query camera settings – using guessed values.', err);
        }
        alert(defaultInfo.width);
        this._cachedCameraInfo = defaultInfo;
        return defaultInfo;
    }

    // Rewritten to be async so we can await real camera info.
    async snapPhoto(camera, { lookAt = null, exclude = [] } = {}, dimX, dimY) {
        // Obtain real (or guessed) camera parameters.
        const camInfo = await this.getIRLCameraData();

        if (!dimX) dimX = camInfo.width;
        if (!dimY) dimY = camInfo.height;

        // Apply camera settings so that the rendered image resembles the real device camera.
        camera.aspect = dimX / dimY;
        camera.fov = camInfo.fov; // GUESS when not available from device
        camera.updateProjectionMatrix();

        const { renderer, scene } = this.sim; // Local refs – avoids relying on globals

        // Create a render target to capture the camera view
        const renderTarget = new THREE.WebGLRenderTarget(dimX, dimY);

        exclude.forEach(obj => obj.visible = false);

        const originalQuaternion = camera.quaternion.clone();
        if (lookAt) {
            camera.lookAt(lookAt);
        }

        // Render the scene from the camera's perspective to the render target
        renderer.setRenderTarget(renderTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null); // Reset to default framebuffer

        if (lookAt) {
            camera.quaternion.copy(originalQuaternion);
        }
        exclude.forEach(obj => obj.visible = true);

        // Read the pixels from the render target
        const pixels = new Uint8Array(dimX * dimY * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, dimX, dimY, pixels);

        // Create a canvas to convert the pixel data to an image
        const canvas = document.createElement('canvas');
        canvas.width = dimX;
        canvas.height = dimY;
        const ctx = canvas.getContext('2d');

        // Create ImageData from the pixel array
        const imageData = ctx.createImageData(dimX, dimY);

        // Flip the image vertically (WebGL renders upside down)
        for (let y = 0; y < dimY; y++) {
            for (let x = 0; x < dimX; x++) {
                const srcIndex = ((dimY - 1 - y) * dimX + x) * 4;
                const dstIndex = (y * dimX + x) * 4;
                imageData.data[dstIndex] = pixels[srcIndex];     // R
                imageData.data[dstIndex + 1] = pixels[srcIndex + 1]; // G
                imageData.data[dstIndex + 2] = pixels[srcIndex + 2]; // B
                imageData.data[dstIndex + 3] = 255;                  // A (full opacity)
            }
        }

        // Put the image data on the canvas
        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to base64 encoded image
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);

        // Log the data URL so you can view it
        //console.log('data:', base64Image);

        // Clean up the render target
        renderTarget.dispose();

        // Return only the data portion (strip the MIME prefix)
        return base64Image.split(',')[1];
    }

}