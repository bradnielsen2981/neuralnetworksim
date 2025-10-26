// Helper to get network structure from nnmodel.js controls
function getNetworkStructure() {
    // Get number of hidden layers and neurons per layer from the UI controls
    // Read neuron counts directly from window.neuronCounts, fallback to [2] if not available
    if (Array.isArray(window.neuronCounts) && window.neuronCounts.length > 0) {
        return window.neuronCounts.slice();
    } else {
        return [2];
    }
}

// Helper to get activation function
function getActivation() {
    return document.getElementById('activation').value;
}

// Helper to get points data from main.js
function getPointsData() {
    // main.js attaches points to window for sharing
    return window.points || [];
}

// Helper to get learning parameters from form
function getLearningParams() {
    return {
        learningRate: parseFloat(document.getElementById('learning-rate').value),
        momentum: parseFloat(document.getElementById('momentum').value),
        epochs: parseInt(document.getElementById('epochs').value),
        earlyStopping: parseFloat(document.getElementById('earlystopping').value)
    };
}

async function trainModelFromUI() {
    // Show the training modal when training starts (after we validate there are points)
    console.log('Train button clicked');
    const neuronCounts = getNetworkStructure();
    const activation = getActivation();
    const { learningRate, momentum, epochs } = getLearningParams();
    // Prepare training data
    const points = getPointsData();

    // Display modal and wire up close handlers (idempotent handlers to avoid duplicates)
    const modal = document.getElementById('training-modal');
    const closeBtn = document.getElementById('close-training-modal');
    const trainBtn = document.getElementById('train-btn');
    if (modal) {
        // Show
        modal.style.display = 'block';
        if (trainBtn) trainBtn.disabled = true;

        // Clear previous handlers if any
        if (closeBtn) closeBtn.onclick = null;
        modal.onclick = null;
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
            modal._escHandler = null;
        }

        // Close when clicking the X
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
            };
        }

        // Close when clicking outside the dialog content (on overlay)
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
            }
        };

        // Close on Escape key (store handler so we can remove it later)
        modal._escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
                if (trainBtn) trainBtn.disabled = false;
            }
        };
        document.addEventListener('keydown', modal._escHandler);
    }

    if (!points.length) {
        // No points - close modal and re-enable button
        if (modal) {
            modal.style.display = 'none';
            if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
        }
        if (trainBtn) trainBtn.disabled = false;
        alert('No training points found. Please add points before training.');
        return;
    }

    const xs = points.map(pt => [pt.x, pt.z]);
    const ys = points.map(pt => [pt.y]);

    // === Sanity checks: ensure inputs/labels are finite numbers ===
    const isFiniteNumber = (n) => typeof n === 'number' && isFinite(n);
    const badPoint = points.find(pt => !isFiniteNumber(pt.x) || !isFiniteNumber(pt.z) || !isFiniteNumber(pt.y));
    if (badPoint) {
        if (modal) {
            modal.style.display = 'none';
            if (modal._escHandler) { document.removeEventListener('keydown', modal._escHandler); modal._escHandler = null; }
            if (trainBtn) trainBtn.disabled = false;
        }
        alert('Training aborted: Found non-finite values in data. Please ensure all X, Z, and Y values are valid numbers.');
        return;
    }

    // Wrap heavy work in try/finally so we always cleanup the modal and button state
    let model = null;
    try {
        // === Build model ===
        model = tf.sequential();
        if (neuronCounts.length > 0) {
            model.add(tf.layers.dense({
                units: neuronCounts[0],
                inputShape: [2],
                activation: activation
            }));
            for (let i = 1; i < neuronCounts.length; i++) {
                model.add(tf.layers.dense({
                    units: neuronCounts[i],
                    activation: activation
                }));
            }
            model.add(tf.layers.dense({ units: 1 }));
        } else {
            model.add(tf.layers.dense({ units: 1, inputShape: [2] }));
        }

        // === Pre-load diagnostic ===
        console.log("=== Pre-Load Diagnostic ===");
        if (Array.isArray(window.weights) && Array.isArray(window.biases)) {
            window.weights.forEach((w, idx) => {
                console.log(`Layer ${idx} stored weight shape: [${w.length}, ${w[0]?.length}]`);
                console.log(`Sample weights:`, w.slice(0, 3));
            });
            window.biases.forEach((b, idx) => {
                console.log(`Layer ${idx} stored bias length: ${b.length}`);
                console.log(`Sample biases:`, b.slice(0, 3));
            });
        }

        // === Load stored weights safely ===
        if (Array.isArray(window.weights) && Array.isArray(window.biases)) {
            const layers = model.layers;
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if (layer.getWeights) {
                    const currentWeights = layer.getWeights();

                    // Transpose stored weights to match TensorFlow's [fan_in, fan_out]
                    let w = window.weights[i] ? tf.transpose(tf.tensor(window.weights[i])) : currentWeights[0];
                    let b = window.biases[i] ? tf.tensor(window.biases[i]) : currentWeights[1];

                    console.log(`Layer ${i} applying weight shape:`, w.shape);
                    console.log(`Layer ${i} applying bias shape:`, b.shape);

                    const weightShapeMatches =
                        w.shape.length === currentWeights[0].shape.length &&
                        w.shape.every((dim, idx) => dim === currentWeights[0].shape[idx]);

                    const biasShapeMatches =
                        b.shape.length === currentWeights[1].shape.length &&
                        b.shape.every((dim, idx) => dim === currentWeights[1].shape[idx]);

                    if (weightShapeMatches && biasShapeMatches) {
                        layer.setWeights([w, b]);
                    } else {
                        alert(`Network weights/biases shape mismatch for layer ${i}. Using default weights.`);
                        console.log("Expected weights:", currentWeights[0].shape, "Biases:", currentWeights[1].shape);
                        console.log("Got weights:", w.shape, "Biases:", b.shape);
                    }
                }
            }
        }

        // === Compile model ===
        // Use momentum optimizer if momentum > 0, otherwise plain SGD
        const useMomentum = typeof momentum === 'number' && !isNaN(momentum) && momentum > 0;
        const optimizer = useMomentum
            ? tf.train.momentum(learningRate, momentum, false) // set true for Nesterov if desired
            : tf.train.sgd(learningRate);
        model.compile({
            loss: 'meanSquaredError',
            optimizer
        });

        // === Train model ===
        const callbacks = {
            onEpochEnd: async (epoch, logs) => {
                const loss = logs && typeof logs.loss === 'number' ? logs.loss : NaN;
                if (!isFinite(loss)) {
                    console.warn('NaN/Inf loss detected at epoch', epoch, '— stopping training.');
                    // Stop training
                    model.stopTraining = true;
                    // Inform user in modal if available
                    const modalBody = document.getElementById('training-modal-body');
                    if (modalBody) {
                        const warn = document.createElement('div');
                        warn.style.marginTop = '10px';
                        warn.style.color = '#c0392b';
                        warn.textContent = 'Training stopped: NaN/Infinity loss detected. Try reducing Learning Rate (e.g., x0.1), reducing Momentum, or using Glorot initialization.';
                        modalBody.appendChild(warn);
                    }
                }
            }
        };
        await model.fit(tf.tensor2d(xs), tf.tensor2d(ys), { epochs, callbacks });
        // Training finished — avoid alerting the user to prevent interruption.
        console.log('Training complete.');

        // === Save weights for drawNetwork ===
        window.weights = [];
        window.biases = [];
        for (const layer of model.layers) {
            if (layer.getWeights) {
                const weights = layer.getWeights();
                // Transpose back to [fan_out][fan_in] for drawNetwork
                const wArray = tf.transpose(weights[0]).arraySync(); 
                const bArray = weights[1].arraySync();
                window.weights.push(wArray);
                window.biases.push(bArray);

                console.log("Saved Layer weights shape:", wArray.length, "x", wArray[0]?.length, "Bias shape:", bArray.length);
            }
        }

        // === Update modal content to "Training complete" ===
        if (modal) {
            const modalBody = document.getElementById('training-modal-body');
            if (modalBody) {
                
                // When training is complete, add a div below the existing content
                const trainingCompleteDiv = document.createElement('div');
                trainingCompleteDiv.textContent = 'Training Complete';
                trainingCompleteDiv.style.marginTop = '10px';
                document.getElementById('training-modal-body').appendChild(trainingCompleteDiv);
            }
        }

        // === Generate prediction mesh for Three.js ===
        if (window.predictionMesh && window.scene) {
            console.log('Removing existing prediction mesh.');
            window.scene.remove(window.predictionMesh);
            window.predictionMesh.geometry.dispose();
            window.predictionMesh.material.dispose();
            window.predictionMesh = null;
        }

        if (window.scene && window.THREE) {
            console.log('Generating new prediction mesh with batching.');
            const step = 1;
            const xMin = -25, xMax = 25, zMin = -25, zMax = 25;
            const xCount = Math.floor((xMax - xMin) / step) + 1;
            const zCount = Math.floor((zMax - zMin) / step) + 1;
            const geometry = new window.THREE.BufferGeometry();
            const vertices = [];
            const colors = [];

            // Prepare batch input for predictions
            const batchInputs = [];
            for (let xi = 0; xi < xCount; xi++) {
                for (let zi = 0; zi < zCount; zi++) {
                    const x = xMin + xi * step;
                    const z = zMin + zi * step;
                    if (x > -26 && x < 26 && z > -26 && z < 26) {
                        batchInputs.push([x, z]);
                    }
                }
            }

            // Perform batch prediction
            const batchTensor = tf.tensor2d(batchInputs);
            const batchOutputs = await model.predict(batchTensor).array();
            batchTensor.dispose();

            // Process predictions
            for (let i = 0; i < batchInputs.length; i++) {
                const [x, z] = batchInputs[i];
                const y = batchOutputs[i][0];
                vertices.push(x, y, z);
                colors.push(0, 1, 0); // Bright green color for better visibility
            }

            console.log('Vertices count:', vertices.length / 3);

            geometry.setAttribute('position', new window.THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('color', new window.THREE.Float32BufferAttribute(colors, 3));

            const indices = [];
            for (let xi = 0; xi < xCount - 1; xi++) {
                for (let zi = 0; zi < zCount - 1; zi++) {
                    const a = xi * zCount + zi;
                    const b = (xi + 1) * zCount + zi;
                    const c = (xi + 1) * zCount + (zi + 1);
                    const d = xi * zCount + (zi + 1);
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new window.THREE.MeshStandardMaterial({
                vertexColors: true,
                side: window.THREE.DoubleSide,
                transparent: false, // Disable transparency for better visibility
                opacity: 1.0 // Fully opaque
            });
            const mesh = new window.THREE.Mesh(geometry, material);
            mesh.name = 'predictionMesh';
            window.scene.add(mesh);
            window.predictionMesh = mesh;

            console.log('Prediction mesh added to scene.');

            // Log camera position and target
            if (window.camera) {
                console.log('Camera position:', window.camera.position);
                console.log('Camera target:', window.controls.target);
            }
        }
    } catch (err) {
        console.error('Training error:', err);
        alert('Training failed: ' + (err && err.message ? err.message : err));
    } finally {
        // Ensure button is re-enabled, but do not hide the modal
        if (trainBtn) trainBtn.disabled = false;
    }

    // === Redraw network ===
    if (typeof window.redrawNetwork === 'function') {
        window.redrawNetwork();
    }

    // === Generate prediction mesh for Three.js ===
    if (window.predictionMesh && window.scene) {
        window.scene.remove(window.predictionMesh);
        window.predictionMesh.geometry.dispose();
        window.predictionMesh.material.dispose();
        window.predictionMesh = null;
    }

    if (window.scene && window.THREE) {
        const step = 1;
        const xMin = -25, xMax = 25, zMin = -25, zMax = 25;
        const xCount = Math.floor((xMax - xMin) / step) + 1;
        const zCount = Math.floor((zMax - zMin) / step) + 1;
        const geometry = new window.THREE.BufferGeometry();
        const vertices = [];
        const colors = [];

        for (let xi = 0; xi < xCount; xi++) {
            for (let zi = 0; zi < zCount; zi++) {
                const x = xMin + xi * step;
                const z = zMin + zi * step;
                // Only use points strictly within -26 < x < 26 and -26 < z < 26
                if (x > -26 && x < 26 && z > -26 && z < 26) {
                    const y = (await model.predict(window.tf.tensor2d([[x, z]])).array())[0][0];
                    vertices.push(x, y, z);
                    colors.push(0.1, 0.4, 0.1);
                }
            }
        }

        geometry.setAttribute('position', new window.THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new window.THREE.Float32BufferAttribute(colors, 3));

        const indices = [];
        for (let xi = 0; xi < xCount - 1; xi++) {
            for (let zi = 0; zi < zCount - 1; zi++) {
                const a = xi * zCount + zi;
                const b = (xi + 1) * zCount + zi;
                const c = (xi + 1) * zCount + (zi + 1);
                const d = xi * zCount + (zi + 1);
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new window.THREE.MeshStandardMaterial({
            vertexColors: true,
            side: window.THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const mesh = new window.THREE.Mesh(geometry, material);
        mesh.name = 'predictionMesh';
        window.scene.add(mesh);
        window.predictionMesh = mesh;
    }
}




// Attach event listener to train button
document.getElementById('train-btn').addEventListener('click', trainModelFromUI);
