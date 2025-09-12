import * as THREE from 'three';
import { OrbitControls } from 'orbitcontrols';

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

// Raycaster + mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0

// Hover marker (green highlight)
const hoverGeometry = new THREE.SphereGeometry(0.25, 12, 12);
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const hoverSphere = new THREE.Mesh(hoverGeometry, hoverMaterial);
hoverSphere.visible = false;
scene.add(hoverSphere);

// Placement state
let activeSphere = null;        // sphere currently being adjusted (or null)
let isAdjustingHeight = false;  // true after first click, before final click
let startMouseY = 0;            // starting mouse Y for height drag
let baseY = 0;                  // initial Y when height adjustment started
const heightSensitivity = 0.02; // adjust to taste (pixels -> units)

// Table body (optional; will be ignored if not present)
const tableBody = document.getElementById('points-table-body');

// Utility: snap to grid vertex
function snapToGrid(value) {
    const step = gridSize / gridDivisions; // grid spacing
    return Math.round(value / step) * step;
}

// Mouse move handler
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

        hoverSphere.position.set(snappedX, 0.25, snappedZ);
        hoverSphere.visible = true;
    } else {
        hoverSphere.visible = false;
    }
}

// Mode toggle logic
let regressionMode = true;
const modeToggleBtn = document.getElementById('mode-toggle');
const pointsLabel = document.querySelector('.points');
const yLabel = document.getElementById('y-label');
const pointsTableBody = document.getElementById('points-table-body');
const pointsTableHead = yLabel.parentElement.parentElement; // <thead>

// Place this below the pointsLabel element
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

// Handle color button clicks
colorModeSelectorElement.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-btn')) {
        selectedColor = e.target.dataset.color;
        // Highlight selected
        document.querySelectorAll('.color-btn').forEach(btn => btn.style.outline = '');
        e.target.style.outline = '3px solid #222';
    }
});

// Store all points here
const points = [];

// Helper to render the table based on mode
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
}

// Helper to update table headers and label
function updateModeUI() {
    if (regressionMode) {
        pointsLabel.innerHTML = '<i class="fa-solid fa-table"></i> Regression Points';
        pointsTableHead.innerHTML = `
            <tr>
                <th scope="col">X</th>
                <th scope="col">Z</th>
                <th scope="col" id="y-label">Y</th>
            </tr>
        `;
        colorModeSelector.style.display = 'none';
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
    }
    renderPointsTable();
}

// Attach event listener for mode toggle
modeToggleBtn.addEventListener('click', () => {
    regressionMode = !regressionMode;
    updateModeUI();
});

// Initial UI setup
updateModeUI();

// Click handler (two-step)
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
    sphere.position.set(hoverSphere.position.x, 0.35, hoverSphere.position.z);
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

// Event listeners
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('click', onClick);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener('resize', () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});
