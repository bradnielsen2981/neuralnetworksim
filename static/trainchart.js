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

// Function to update the chart dynamically from real training
function updateLossChart(epoch, loss) {
    lossChart.data.labels.push(epoch);
    lossChart.data.datasets[0].data.push(loss);
    lossChart.update();
}

// Function to reset/clear the loss chart when training starts
function resetLossChart() {
    lossChart.data.labels = [];
    lossChart.data.datasets[0].data = [];
    lossChart.update();
}