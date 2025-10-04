

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

// Build and train the model
async function trainModelFromUI() {
    // Removed alert
    // Get network structure from nnmodel.js controls
    const neuronCounts = getNetworkStructure();
    const activation = getActivation();
    const { learningRate, momentum, epochs } = getLearningParams();

    // Prepare data from main.js points
    const points = getPointsData();
    if (!points.length) {
    // Removed alert
        return;
    }
    // Removed console.log

    // X: [ [x, z], ... ]   Y: [ [y], ... ]
    const xs = points.map(pt => [pt.x, pt.z]);
    const ys = points.map(pt => [pt.y]);
        // Print each training point in the requested format
        xs.forEach((input, i) => {
            // Removed console.log
        });

    // Build model with the same structure as nnmodel.js
    const model = tf.sequential();
    if (neuronCounts.length > 0) {
        // First hidden layer with input shape
        model.add(tf.layers.dense({
            units: neuronCounts[0],
            inputShape: [2],
            activation: activation
        }));
        // Additional hidden layers
        for (let i = 1; i < neuronCounts.length; i++) {
            model.add(tf.layers.dense({
                units: neuronCounts[i],
                activation: activation
            }));
        }
        // Output layer
        model.add(tf.layers.dense({ units: 1 }));
    } else {
        // No hidden layers, just input to output
        model.add(tf.layers.dense({ units: 1, inputShape: [2] }));
    }

    // Compile
    model.compile({
        loss: 'meanSquaredError',
        optimizer: tf.train.sgd(learningRate)
    });

    // Train
    await model.fit(tf.tensor2d(xs), tf.tensor2d(ys), { epochs });
    // Removed alert

    // === Generate prediction mesh and add to Three.js scene ===
    // Remove previous prediction mesh if it exists
    if (window.predictionMesh && window.scene) {
        window.scene.remove(window.predictionMesh);
        window.predictionMesh.geometry.dispose();
        window.predictionMesh.material.dispose();
        window.predictionMesh = null;
    }

    // Access the Three.js scene from main.js
    if (window.scene && window.THREE) {

    // Removed alert
        const step = 1; // grid step size
        const xMin = -20, xMax = 20, zMin = -20, zMax = 20;
        const xCount = Math.floor((xMax - xMin) / step) + 1;
        const zCount = Math.floor((zMax - zMin) / step) + 1;
        const geometry = new window.THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        // Predict y for each (x, z)
        for (let xi = 0; xi < xCount; xi++) {
            for (let zi = 0; zi < zCount; zi++) {
                const x = xMin + xi * step;
                const z = zMin + zi * step;
                const y = (await model.predict(window.tf.tensor2d([[x, z]])).array())[0][0];
                    // Print prediction in requested format
                    // Removed console.log
                vertices.push(x, y, z);
                // Dark green color
                colors.push(0.1, 0.4, 0.1);
            }
        }
            // Removed console.log
        geometry.setAttribute('position', new window.THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new window.THREE.Float32BufferAttribute(colors, 3));

        // Create faces (triangles)
        const indices = [];
        for (let xi = 0; xi < xCount - 1; xi++) {
            for (let zi = 0; zi < zCount - 1; zi++) {
                const a = xi * zCount + zi;
                const b = (xi + 1) * zCount + zi;
                const c = (xi + 1) * zCount + (zi + 1);
                const d = xi * zCount + (zi + 1);
                // Two triangles per quad
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
