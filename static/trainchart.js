// Create a chart to model a loss function using Chart.js
const chartContext = document.getElementById('lossChart').getContext('2d');
const lossChart = new Chart(chartContext, {
    type: 'line',
    data: {
        labels: [], // Initialize with empty labels, to be updated dynamically
        datasets: [{
            label: 'Loss Function',
            data: [], // Initialize with empty data, to be updated dynamically
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Epochs'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Loss'
                },
                beginAtZero: true
            }
        }
    }
});

// Function to update the chart dynamically
function updateLossChart(epoch, loss) {
    lossChart.data.labels.push(epoch);
    lossChart.data.datasets[0].data.push(loss);
    lossChart.update();
}

// Update the lossChart to model the loss function during training
async function trainAndUpdateLossChart() {
    const epochs = window.epochs;
    const learningRate = window.learningRate;
    const momentum = window.momentum;
    const earlyStopping = window.earlyStopping;

    for (let epoch = 1; epoch <= epochs; epoch++) {
        // Simulate training step and calculate loss (replace with actual training logic)
        const loss = Math.exp(-epoch / 10) + Math.random() * 0.05; // Example loss function

        // Update the chart dynamically
        updateLossChart(epoch, loss);

        // Simulate delay for visualization (remove in real training)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Early stopping condition (example)
        if (loss < earlyStopping) {
            console.log(`Early stopping at epoch ${epoch}`);
            break;
        }
    }
}

// Call the function to start training and updating the chart
trainAndUpdateLossChart();