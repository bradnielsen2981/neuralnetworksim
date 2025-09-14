import * as THREE from 'three';
import { OrbitControls } from 'orbitcontrols';

// ================= INITIALIZATION =================
// Get the container for the Three.js scene
const container = document.getElementById('three-container');
 
// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Set up the camera
const fov = 50;
const aspect = 2;
const near = 0.1;
const far = 100;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(20, 5, 20);

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Grid
const gridSize = 50;
const gridDivisions = 50;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0x444444);
scene.add(gridHelper);

// Raycaster + mouse for 3D interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0

// Hover marker (green highlight)
const hoverGeometry = new THREE.SphereGeometry(0.25, 12, 12);
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const hoverSphere = new THREE.Mesh(hoverGeometry, hoverMaterial);
hoverSphere.visible = false;
scene.add(hoverSphere);

// Placement state for sphere placement/adjustment
let activeSphere = null;        // sphere currently being adjusted (or null)
let isAdjustingHeight = false;  // true after first click, before final click
let startMouseY = 0;            // starting mouse Y for height drag
let baseY = 0;                  // initial Y when height adjustment started
const heightSensitivity = 0.02; // adjust to taste (pixels -> units)

// Table body (optional; will be ignored if not present)
const tableBody = document.getElementById('points-table-body');

// ================ CANVAS RESIZE LOGIC ================
function resizeCanvas() {
    const canvas = document.getElementById('networkCanvas');
    const container = document.getElementById('canvasContainer');
    if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = 460; // or container.clientHeight for dynamic height
        if (typeof drawNetwork === 'function') {
            drawNetwork();
        }
    }
}

// ================ UTILITY FUNCTIONS ================
// Snap to grid vertex
function snapToGrid(value) {
    const step = gridSize / gridDivisions; // grid spacing
    return Math.round(value / step) * step;
}

// ================ EVENT HANDLERS ================
// Mouse move handler for 3D interaction
function onMouseMove(event) {
    // normalized device coords for raycaster
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // If we're adjusting height, use mouse Y delta to move the active sphere vertically
    if (isAdjustingHeight && activeSphere) {
        const deltaPixels = startMouseY - event.clientY; // positive when mouse moved up
        const deltaUnits = deltaPixels * heightSensitivity;
        const newY = Math.max(0.1, baseY + deltaUnits); // clamp to >= 0.1
        activeSphere.position.y = newY;
        return;
    }

    // Otherwise we are hovering over the grid -> show hoverSphere at snapped X/Z
    raycaster.setFromCamera(mouse, camera);
    const point = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());

    if (point) {
        const snappedX = snapToGrid(point.x);
        const snappedZ = snapToGrid(point.z);

        // Center the sphere at the grid point (Y = 0)
        hoverSphere.position.set(snappedX, 0, snappedZ);
        hoverSphere.visible = true;
    } else {
        hoverSphere.visible = false;
    }
}

// Mode toggle logic and UI elements
let regressionMode = true;
const modeToggleBtn = document.getElementById('mode-toggle');
const pointsLabel = document.querySelector('.points');
const yLabel = document.getElementById('y-label');
const pointsTableBody = document.getElementById('points-table-body');
const pointsTableHead = yLabel.parentElement.parentElement; // <thead>

// Place color selector below the pointsLabel element
const colorModeSelector = document.createElement('div');
colorModeSelector.id = 'color-mode-selector';
colorModeSelector.style.display = 'none';
colorModeSelector.style.margin = '8px 0';
colorModeSelector.innerHTML = `
  <label>Choose class colour:</label>
  <button class="color-btn" data-color="Red" style="background:#e74c3c"></button>
  <button class="color-btn" data-color="Green" style="background:#27ae60"></button>
  <button class="color-btn" data-color="Blue" style="background:#2980b9"></button>
  <button class="color-btn" data-color="Yellow" style="background:#f1c40f"></button>
`;
pointsLabel.insertAdjacentElement('afterend', colorModeSelector);

const colorModeSelectorElement = document.getElementById('color-mode-selector');
let selectedColor = 'Green'; // Default

const colorMap = {
    Red: 0xe74c3c,
    Green: 0x27ae60,
    Blue: 0x2980b9,
    Yellow: 0xf1c40f
};

// Handle color button clicks for classification mode
colorModeSelectorElement.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-btn')) {
        selectedColor = e.target.dataset.color;
        // Highlight selected
        document.querySelectorAll('.color-btn').forEach(btn => btn.style.outline = '');
        e.target.style.outline = '3px solid #222';

        // Change hoverSphere color to match selected color in classification mode
        if (!regressionMode) {
            hoverSphere.material.color.setHex(colorMap[selectedColor]);
        }
    }
});

// ================ POINTS DATA AND TABLE ================
// Store all points here
const points = [];

// Helper to render the table based on mode (regression/classification)
function renderPointsTable() {
    pointsTableBody.innerHTML = '';
    if (regressionMode) {
        points.forEach(pt => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pt.x.toFixed(2)}</td>
                <td>${pt.z.toFixed(2)}</td>
                <td>${pt.y.toFixed(2)}</td>
            `;
            pointsTableBody.appendChild(row);
        });
    } else {
        points.forEach(pt => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pt.x.toFixed(2)}</td>
                <td>${pt.y.toFixed(2)}</td>
                <td>${pt.z.toFixed(2)}</td>
                <td>${pt.class || 'Green'}</td>
            `;
            pointsTableBody.appendChild(row);
        });
    }
    window.points = points; // <-- Add this line
}

// Show/hide the button based on mode (UI update)
function updateModeUI() {
    if (regressionMode) {
        pointsLabel.innerHTML = '<i class="fa-solid fa-table"></i> Regression Points ' +
            '<button id="generate-random-btn" class="btn btn-sm btn-secondary ms-2">Generate 20 Random Points</button>';
        pointsTableHead.innerHTML = `
            <tr>
                <th scope="col">X</th>
                <th scope="col">Z</th>
                <th scope="col" id="y-label">Y</th>
            </tr>
        `;
        colorModeSelector.style.display = 'none';
        hoverSphere.material.color.setHex(0x00ff00);
        // Re-attach event listener after replacing innerHTML
        setTimeout(() => {
            document.getElementById('generate-random-btn').onclick = generateRandomPoints;
        }, 0);
    } else {
        pointsLabel.innerHTML = '<i class="fa-solid fa-table"></i> Classification Points';
        pointsTableHead.innerHTML = `
            <tr>
                <th scope="col">X</th>
                <th scope="col">Y</th>
                <th scope="col">Z</th>
                <th scope="col">Class</th>
            </tr>
        `;
        colorModeSelector.style.display = '';
        hoverSphere.material.color.setHex(colorMap[selectedColor]);
    }
    renderPointsTable();
}

// Generate 20 random regression points and add to scene/table
function generateRandomPoints() {
    // Remove any spheres previously added (except hoverSphere)
    scene.children
        .filter(obj => obj.isMesh && obj.geometry.type === "SphereGeometry" && obj !== hoverSphere)
        .forEach(obj => scene.remove(obj));
    points.length = 0; // Clear points array

    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 40 - 20; // -20 <= x <= 20
        const z = Math.random() * 40 - 20; // -20 <= z <= 20
        const y = Math.random() * 10 - 5;  // -5 <= y <= 5

        // Add to points array
        points.push({ x, y, z });

        // Add sphere to scene
        const sphereGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(x, y, z);
        scene.add(sphere);
    }
    window.points = points; // <-- Add this line
    renderPointsTable();
}

// Click handler for placing and adjusting spheres (two-step)
function onClick(event) {
    // If we are currently adjusting height -> finalize placement
    if (isAdjustingHeight && activeSphere) {
        const { x, y, z } = activeSphere.position;
        let classLabel = '';
        if (regressionMode) {
            points.push({ x, y, z });
        } else {
            classLabel = selectedColor;
            points.push({ x, y, z, class: classLabel });
        }
        renderPointsTable();

        // clear state and re-enable controls
        activeSphere = null;
        isAdjustingHeight = false;
        controls.enabled = true;
        hoverSphere.visible = true; // resume hover
        return;
    }

    // Not adjusting currently -> start placement if hovering a vertex
    if (!hoverSphere.visible) return;

    // create the placed sphere and enter height-adjust mode
    const sphereGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    let sphereMaterial;
    if (regressionMode) {
        sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    } else {
        sphereMaterial = new THREE.MeshStandardMaterial({ color: colorMap[selectedColor] });
    }
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    // initial Y set slightly above ground so it's visible
    // Center the sphere at the grid point (Y = 0.0)
    sphere.position.set(hoverSphere.position.x, 0, hoverSphere.position.z);
    scene.add(sphere);

    // set state for vertical adjustment
    activeSphere = sphere;
    isAdjustingHeight = true;
    startMouseY = event.clientY;
    baseY = sphere.position.y;

    // disable orbit controls so camera doesn't move while adjusting
    controls.enabled = false;
    // optionally hide the hover to avoid duplicate indicators
    hoverSphere.visible = false;
}

// ================ ANIMATION LOOP ================
// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.getElementById('y-label').textContent = regressionMode ? 'Y' : 'Class';
animate();
// ================ WINDOW & UI EVENT LISTENERS ================
// Handle window resize for both Three.js and 2D canvas
window.addEventListener('resize', () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    resizeCanvas();
});

// Mode toggle button (single source of truth)
modeToggleBtn.addEventListener('click', () => {
    regressionMode = !regressionMode;
    updateModeUI();
});

// Initialise UI and event listeners
updateModeUI();
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('click', onClick);
resizeCanvas();
animate();

window.scene = scene;
window.THREE = THREE;

