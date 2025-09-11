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

// Click handler (two-step)
function onClick(event) {
    // If we are currently adjusting height -> finalize placement
    if (isAdjustingHeight && activeSphere) {
        // finalize: add to table (if present)
        const { x, y, z } = activeSphere.position;
        if (tableBody) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${x.toFixed(2)}</td>
                <td>${z.toFixed(2)}</td>
                <td>${y.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
        }

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
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
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
