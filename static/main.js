

// ========== GLOBAL Add Point Mode STATE ========== //
let addPointMode = false;


// ========== HEADER BUTTON EVENT HANDLERS ========== //
window.addEventListener('DOMContentLoaded', () => {
    // Add Point Mode toggle (off by default)
    const addPointBtn = document.getElementById('add-point-btn');
    function setAddPointMode(on) {
        addPointMode = on;
        if (addPointMode) {
            addPointBtn.classList.add('active');
            addPointBtn.classList.remove('btn-success');
            addPointBtn.classList.add('btn-warning');
            addPointBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Point Mode (ON)';
            // Set dark orange background
            addPointBtn.style.backgroundColor = '#d35400';
            addPointBtn.style.color = '#fff';
        } else {
            addPointBtn.classList.remove('active');
            addPointBtn.classList.remove('btn-warning');
            addPointBtn.classList.add('btn-success');
            addPointBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Point Mode';
            // Reset to default (Bootstrap success green)
            addPointBtn.style.backgroundColor = '';
            addPointBtn.style.color = '';
        }
    }
    // Set initial state (off)
    setAddPointMode(false);
    addPointBtn.addEventListener('click', () => setAddPointMode(!addPointMode));
    // Right-click disables add point mode
    document.getElementById('three-container').addEventListener('contextmenu', (e) => {
        if (addPointMode) {
            setAddPointMode(false);
            e.preventDefault();
        }
    });
        // Pyramid, Ramp, Random, Clear
        const pyramidBtn = document.getElementById('generate-pyramid-btn');
        const rampBtn = document.getElementById('generate-ramp-btn');
        const randomBtn = document.getElementById('generate-random-btn');
        const clearBtn = document.getElementById('clear-points-btn');

        pyramidBtn.onclick = generatePyramidPoints;
        rampBtn.onclick = generateRampPoints;
        randomBtn.onclick = generateRandomPoints;
        clearBtn.onclick = clearPoints;

        // Set button colors
        pyramidBtn.style.backgroundColor = '#2980b9'; // blue
        pyramidBtn.style.color = '#fff';
        rampBtn.style.backgroundColor = '#ff00ff'; // magenta
        rampBtn.style.color = '#fff';
        randomBtn.style.backgroundColor = '#f1c40f'; // yellow
        randomBtn.style.color = '#222';

    // Only allow placing points if addPointMode is ON
    /*const origOnClick = onClick;
    function wrappedOnClick(event) {
        if (!addPointMode) return;
        origOnClick(event);
    }
    // Remove previous click event and add wrapped
    const threeContainer = document.getElementById('three-container');
    threeContainer.removeEventListener('click', onClick);
    threeContainer.addEventListener('click', wrappedOnClick);*/
});

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

function clearPoints() {
    // Remove all objects from the scene except hoverSphere
    scene.children
        .filter(obj => obj !== hoverSphere && obj.type === 'Mesh')
        .forEach(obj => scene.remove(obj));

    // Only clear the points array and table, not the container
    points.length = 0;
    window.points = points;
    renderPointsTable();
    console.log("All points cleared");
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
    // Only show hoverSphere if Add Point Mode is ON
    if (!addPointMode) {
        hoverSphere.visible = false;
        return;
    }
    // normalized device coords for raycaster
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // If we're adjusting height, use mouse Y delta to move the active sphere vertically
    if (isAdjustingHeight && activeSphere) {
        const deltaPixels = startMouseY - event.clientY; // positive when mouse moved up
        const deltaUnits = deltaPixels * heightSensitivity;
        // Allow y to be negative, clamp to [-20, 20]
        const newY = Math.max(-20, Math.min(20, baseY + deltaUnits));
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
    alert("Updating Mode UI");
    if (regressionMode) {
        pointsLabel.innerHTML = '<i class="fa-solid fa-table"></i> Regression Points '
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
            document.getElementById('generate-pyramid-btn').onclick = generatePyramidPoints;
            document.getElementById('generate-ramp-btn').onclick = generateRampPoints; 
            document.getElementById('clear-points-btn').onclick = clearPoints;
        }, 0);
// Clear all points and remove spheres from the scene
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


// ================ GLOBAL POINT GENERATION FUNCTIONS ================
function generateRandomPoints() {
    alert("Generating Random Points");
    // Clear existing points and spheres (except hoverSphere)
    scene.children.filter(obj => obj !== hoverSphere && obj.type === 'Mesh').forEach(obj => scene.remove(obj));
    points.length = 0;
    const usedXZ = new Set();
    let count = 0;
    while (count < 16) {
        // X and Z in grid range, snapped to grid
        const step = gridSize / gridDivisions;
        const x = snapToGrid((Math.random() - 0.5) * gridSize);
        const z = snapToGrid((Math.random() - 0.5) * gridSize);
        const key = `${x.toFixed(4)},${z.toFixed(4)}`;
        if (usedXZ.has(key)) continue;
        usedXZ.add(key);
        // y in [-10, 10]
        const y = Math.random() * 20 - 10;
        points.push({ x, y, z, class: 'Yellow' });
        // Add sphere
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xf1c40f }) // yellow
        );
        sphere.position.set(x, y, z);
        scene.add(sphere);
        count++;
    }
    renderPointsTable();
}


function generatePyramidPoints() {
    //alert("Generating Pyramid Points");
    // Clear existing points and spheres (except hoverSphere)
    scene.children.filter(obj => obj !== hoverSphere && obj.type === 'Mesh').forEach(obj => scene.remove(obj));
    points.length = 0;
    // Pyramid parameters
    const baseSize = 16; // width of base
    const height = 12;
    const baseY = 0;
    const cx = 0, cz = 0; // center
    // 4 corners of base
    const corners = [
        { x: cx - baseSize/2, z: cz - baseSize/2 },
        { x: cx + baseSize/2, z: cz - baseSize/2 },
        { x: cx + baseSize/2, z: cz + baseSize/2 },
        { x: cx - baseSize/2, z: cz + baseSize/2 }
    ];
    // Midpoints of each side
    const mids = [
        { x: cx, z: cz - baseSize/2 },
        { x: cx + baseSize/2, z: cz },
        { x: cx, z: cz + baseSize/2 },
        { x: cx - baseSize/2, z: cz }
    ];
    // Apex
    const apex = { x: cx, y: baseY + height, z: cz };
    // Place points along edges (no base)
    const edgePoints = [];
    // For each edge from base to apex (corners and mids)
    function edge(a, b, n) {
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            edgePoints.push({
                x: a.x + (b.x - a.x) * t,
                y: baseY + (b.y !== undefined ? (b.y - baseY) * t : 0),
                z: a.z + (b.z - a.z) * t
            });
        }
    }
    // Edges: corners to apex
    for (const c of corners) edge(c, apex, 5);
    // Edges: mids to apex
    for (const m of mids) edge(m, apex, 3);
    // Edges: between corners (base perimeter, but not base itself)
    for (let i = 0; i < 4; i++) edge(corners[i], corners[(i+1)%4], 3);
    // Edges: between mids (base perimeter, but not base itself)
    for (let i = 0; i < 4; i++) edge(mids[i], mids[(i+1)%4], 1);
    // Remove duplicates (by x,z,y)
    const uniq = {};
    for (const pt of edgePoints) {
        const key = `${pt.x.toFixed(4)},${pt.y.toFixed(4)},${pt.z.toFixed(4)}`;
        if (!uniq[key]) {
            uniq[key] = pt;
        }
    }
    const allPts = Object.values(uniq);
    // If more than 64, trim; if less, add apex again
    while (allPts.length < 64) allPts.push({ ...apex });
    while (allPts.length > 64) allPts.pop();
    for (const pt of allPts) {
        points.push({ x: pt.x, y: pt.y !== undefined ? pt.y : baseY, z: pt.z, class: 'Blue' });
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x2980b9 }) // blue
        );
        sphere.position.set(pt.x, pt.y !== undefined ? pt.y : baseY, pt.z);
        scene.add(sphere);
    }
    renderPointsTable();
    
}

function generateRampPoints() {
    alert("Generating Ramp Points");
    // Clear existing points and spheres (except hoverSphere)
    scene.children.filter(obj => obj !== hoverSphere && obj.type === 'Mesh').forEach(obj => scene.remove(obj));
    points.length = 0;
    // Ramp parameters
    const width = 20;
    const lines = 4;
    const pointsPerLine = 8;
    const spacing = width / (pointsPerLine - 1);
    const yStart = 0;
    const yStep = 1; // 45 deg: y increases by same as x
    const zStart = -width/2;
    for (let l = 0; l < lines; l++) {
        const x0 = -width/2 + l * (width/(lines-1));
        for (let i = 0; i < pointsPerLine; i++) {
            const x = x0;
            const z = zStart + i * spacing;
            const y = yStart + i * yStep;
            points.push({ x, y, z, class: 'Magenta' });
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 16, 16),
                new THREE.MeshStandardMaterial({ color: 0xff00ff }) // magenta
            );
            sphere.position.set(x, y, z);
            scene.add(sphere);
        }
    }
    renderPointsTable();
}



// Click handler for placing and adjusting spheres (two-step)
function onClick(event) {
    // If we are currently adjusting height -> finalize placement
    if (isAdjustingHeight && activeSphere) {
        const { x, y, z } = activeSphere.position;
        let classLabel = '';
        // Clamp z to [-20, 20] before saving
        const clampedZ = Math.max(-20, Math.min(20, z));
        if (regressionMode) {
            points.push({ x, y, z: clampedZ });
        } else {
            classLabel = selectedColor;
            points.push({ x, y, z: clampedZ, class: classLabel });
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

    // Clamp z to [-20, 20] for placement, y starts at 0
    const clampedZ = Math.max(-20, Math.min(20, hoverSphere.position.z));
    const x = hoverSphere.position.x;
    const z = clampedZ;
    // Prevent duplicate xz positions
    const duplicate = points.some(pt => Math.abs(pt.x - x) < 1e-6 && Math.abs(pt.z - z) < 1e-6);
    if (duplicate) {
        alert("Please place a point on another position. In Regression, two points sharing the same XZ value will confuse the learning algorithm.");
        return;
    }

    // create the placed sphere and enter height-adjust mode
    const sphereGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    let sphereMaterial;
    if (regressionMode) {
        sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    } else {
        sphereMaterial = new THREE.MeshStandardMaterial({ color: colorMap[selectedColor] });
    }
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(x, 0, z);
    scene.add(sphere);

    // set state for vertical adjustment
    activeSphere = sphere;
    isAdjustingHeight = true;
    startMouseY = event.clientY;
    baseY = 0; // always start at y=0 for adjustment

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

