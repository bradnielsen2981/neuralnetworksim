// Create a chart to model a loss function using Chart.js
const chartContext = document.getElementById('lossChart').getContext('2d');
const lossChart = new Chart(chartContext, {
    type: 'line',
    data: {
        labels: [], // no longer used for x values (we use {x,y} points)
        datasets: [{
            label: 'Loss Function',
            data: [], // will store objects: { x: epoch, y: loss }
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 2,
            tension: 0,
            spanGaps: false,
            clip: 0
        }]
    },
    options: {
        responsive: true,
        animation: { duration: 0 },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            }
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                max: 0, // start with no future beyond 0
                bounds: 'data', // do not extend past data
                offset: false,
                grace: 0,
                ticks: { precision: 0 },
                title: {
                    display: true,
                    text: 'Epochs'
                }
            },
            y: {
                min: 0,
                max: 5, // start Y scale at 5
                title: {
                    display: true,
                    text: 'Loss'
                }
            }
        }
    }
});

// Track last epoch when Y max was reduced to slow zoom-in
let lastYShrinkEpoch = 0;

// Function to update the chart dynamically from real training
function updateLossChart(epoch, loss) {
    // Push as an XY point; no label push
    lossChart.data.datasets[0].data.push({ x: epoch, y: loss });

    // Anchor X-axis to the last data point and cap to last 250 epochs
    const xScale = lossChart.options.scales.x;
    if (xScale) {
        const data = lossChart.data.datasets[0].data;
        const lastX = data.length ? data[data.length - 1].x : epoch;
        const end = lastX;
        const start = Math.max(0, end - 250);
        xScale.min = start;
        xScale.max = end;
    }

    // Dynamic Y-axis: keep losses in the lower half of the chart
    const yScale = lossChart.options.scales.y;
    if (yScale) {
        const currentYMax = typeof yScale.max === 'number' ? yScale.max : undefined;
        const yMin = typeof yScale.min === 'number' ? yScale.min : 0;
        // Use a recent window to compute max loss; this smooths out outliers
        const dataPoints = lossChart.data.datasets[0].data;
        const windowSize = 30;
        const recent = dataPoints.slice(Math.max(0, dataPoints.length - windowSize));
        const recentMax = recent.reduce((m, p) => Math.max(m, p.y), 0);
        // Target y.max so that recentMax sits at ~47% of the vertical range (pad ≈ 2.1)
        const pad = 2.1;
        const targetMax = Math.max(1, Number(((recentMax * pad) || 1).toFixed(6)));

        if (typeof currentYMax === 'number') {
            if (currentYMax < targetMax) {
                // Expand immediately to keep points in lower half
                yScale.max = targetMax;
            } else if (currentYMax > targetMax) {
                // Shrink slowly to avoid jitter
                const cooldown = 10; // epochs between shrinks
                if ((epoch - lastYShrinkEpoch) >= cooldown) {
                    const limited = Math.max(targetMax, Number((currentYMax * 0.9).toFixed(6)), 1);
                    if (limited < currentYMax) {
                        yScale.max = limited;
                        lastYShrinkEpoch = epoch;
                    }
                }
            }
        } else {
            yScale.max = targetMax;
        }
        // Keep min at 0
        yScale.min = 0;
    }

    lossChart.update('none');
}

// Function to reset/clear the loss chart when training starts
function resetLossChart() {
    // Clear only the dataset
    lossChart.data.datasets[0].data = [];
    // Restore X window anchored at 0 (no space to the right)
    if (lossChart.options && lossChart.options.scales && lossChart.options.scales.x) {
        lossChart.options.scales.x.min = 0;
        lossChart.options.scales.x.max = 0;
    }
    // Reset Y scale start back to 5 and state
    if (lossChart.options && lossChart.options.scales && lossChart.options.scales.y) {
        lossChart.options.scales.y.min = 0;
        lossChart.options.scales.y.max = 5;
    }
    lastYShrinkEpoch = 0;
    lossChart.update();
}