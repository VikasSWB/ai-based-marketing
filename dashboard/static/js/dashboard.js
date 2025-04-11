

// Object to store chart instances
const charts = {};

// Function to destroy a chart if it exists
function destroyChart(chartKey) {
    if (charts[chartKey] && typeof charts[chartKey].destroy === 'function') {
        charts[chartKey].destroy();
        delete charts[chartKey];
    }
}

// Common Chart.js options for consistent styling
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, family: 'Roboto' },
            bodyFont: { size: 12, family: 'Roboto' },
            padding: 10,
            cornerRadius: 5
        }
    }
};

// Options for Website Views chart
const websiteViewsOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#E3F2FD', // Light blue for blue background
                font: { family: 'Roboto', size: 12 }
            },
            title: {
                display: true,
                color: '#E3F2FD',
                font: { family: 'Roboto', size: 14 },
                text: 'Day'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#E3F2FD',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#E3F2FD',
                font: { family: 'Roboto', size: 14 },
                text: 'Orders'
            }
        }
    }
};

// Options for Daily Sales chart
const dailySalesOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#E8F5E9', // Light green for green background
                font: { family: 'Roboto', size: 12 }
            },
            title: {
                display: true,
                color: '#E8F5E9',
                font: { family: 'Roboto', size: 14 },
                text: 'Month'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#E8F5E9',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#E8F5E9',
                font: { family: 'Roboto', size: 14 },
                text: 'Revenue ($)'
            }
        }
    }
};

// Options for Order Status Breakdown chart
const orderStatusOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#FFEBEE', // Light red for red background
                font: { family: 'Roboto', size: 12 }
            },
            title: {
                display: true,
                color: '#FFEBEE',
                font: { family: 'Roboto', size: 14 },
                text: 'Order Status'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#FFEBEE',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#FFEBEE',
                font: { family: 'Roboto', size: 14 },
                text: 'Average Order Total ($)'
            }
        }
    }
};

// Options for Revenue by Payment Method chart
const paymentMethodOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#E1BEE7', // Light purple for purple background
                font: { family: 'Roboto', size: 12 }
            },
            title: {
                display: true,
                color: '#E1BEE7',
                font: { family: 'Roboto', size: 14 },
                text: 'Payment Method'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#E1BEE7',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#E1BEE7',
                font: { family: 'Roboto', size: 14 },
                text: 'Total Revenue ($)'
            }
        }
    }
};

// Options for Average Order Value by Customer chart
const avgOrderValueOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#FFF8E1', // Light yellow for yellow background
                font: { family: 'Roboto', size: 12 },
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#FFF8E1',
                font: { family: 'Roboto', size: 14 },
                text: 'Customer Email'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#FFF8E1',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#FFF8E1',
                font: { family: 'Roboto', size: 14 },
                text: 'Average Order Value ($)'
            }
        }
    }
};

// Options for Payment Method Popularity chart (Pie Chart)
const paymentPopularityOptions = {
    ...commonOptions,
    plugins: {
        legend: {
            display: true,
            position: 'right',
            labels: {
                color: '#E0F7FA', // Light cyan for cyan background
                font: { family: 'Roboto', size: 12 }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, family: 'Roboto' },
            bodyFont: { size: 12, family: 'Roboto' },
            padding: 10,
            cornerRadius: 5
        }
    }
};

// Fetch dashboard data and populate charts
function fetchDashboardData() {
    fetch('/dashboard-data/')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse JSON response:", text);
                    throw new Error("Invalid JSON response from server.");
                }
            });
        })
        .then(data => {
            if (data.error) {
                console.error("Error fetching dashboard data:", data.error);
                const errorDiv = document.getElementById('error');
                if (errorDiv) {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // 1. Website Views Chart
            const websiteViewsCanvas = document.getElementById('websiteViewsChart');
            if (websiteViewsCanvas) {
                const days = data.days;
                const orderCounts = data.order_counts;
                console.log("Website Views Data:", { days: days, orderCounts: orderCounts });
                destroyChart('websiteViewsChart');
                if (days.length > 0 && orderCounts.length > 0) {
                    charts['websiteViewsChart'] = new Chart(websiteViewsCanvas.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: days,
                            datasets: [{
                                label: 'Orders',
                                data: orderCounts,
                                borderColor: 'rgba(255, 255, 255, 1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                fill: false,
                                tension: 0.4,
                                pointBackgroundColor: 'white',
                                pointBorderColor: 'white',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }]
                        },
                        options: websiteViewsOptions
                    });
                    websiteViewsCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Website Views Chart.");
                    websiteViewsCanvas.style.display = 'none';
                }
            }

            // 2. Daily Sales Chart
            const dailySalesCanvas = document.getElementById('dailySalesChart');
            if (dailySalesCanvas) {
                const months = data.months;
                const revenues = data.revenues;
                console.log("Daily Sales Data:", { months: months, revenues: revenues });
                destroyChart('dailySalesChart');
                if (months.length > 0 && revenues.length > 0) {
                    charts['dailySalesChart'] = new Chart(dailySalesCanvas.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: months,
                            datasets: [{
                                label: 'Revenue ($)',
                                data: revenues,
                                borderColor: 'rgba(255, 255, 255, 1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                fill: false,
                                tension: 0.4,
                                pointBackgroundColor: 'white',
                                pointBorderColor: 'white',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }]
                        },
                        options: dailySalesOptions
                    });
                    dailySalesCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Daily Sales Chart.");
                    dailySalesCanvas.style.display = 'none';
                }
            }

            // 3. Order Status Breakdown Chart
            const orderStatusCanvas = document.getElementById('orderStatusChart');
            if (orderStatusCanvas) {
                const statuses = data.statuses;
                const avgTotals = data.avg_totals;
                console.log("Order Status Data:", { statuses: statuses, avgTotals: avgTotals });
                destroyChart('orderStatusChart');
                if (statuses.length > 0 && avgTotals.length > 0) {
                    charts['orderStatusChart'] = new Chart(orderStatusCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: statuses,
                            datasets: [{
                                label: 'Average Order Total ($)',
                                data: avgTotals,
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 0,
                                borderRadius: 5
                            }]
                        },
                        options: orderStatusOptions
                    });
                    orderStatusCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Order Status Chart.");
                    orderStatusCanvas.style.display = 'none';
                }
            }

            // 4. Revenue by Payment Method Chart
            const paymentMethodCanvas = document.getElementById('paymentMethodChart');
            if (paymentMethodCanvas) {
                const methods = data.payment_methods;
                const totals = data.payment_totals;
                console.log("Payment Method Data:", { methods: methods, totals: totals });
                destroyChart('paymentMethodChart');
                if (methods.length > 0 && totals.length > 0) {
                    charts['paymentMethodChart'] = new Chart(paymentMethodCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: methods,
                            datasets: [{
                                label: 'Total Revenue ($)',
                                data: totals,
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 0,
                                borderRadius: 5
                            }]
                        },
                        options: paymentMethodOptions
                    });
                    paymentMethodCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Payment Method Chart.");
                    paymentMethodCanvas.style.display = 'none';
                }
            }

            // 5. Average Order Value by Customer Chart
            const avgOrderValueCanvas = document.getElementById('avgOrderValueChart');
            if (avgOrderValueCanvas) {
                const customers = data.customer_emails;
                const avgValues = data.avg_values;
                console.log("Average Order Value Data:", { customers: customers, avgValues: avgValues });
                destroyChart('avgOrderValueChart');
                if (customers.length > 0 && avgValues.length > 0) {
                    charts['avgOrderValueChart'] = new Chart(avgOrderValueCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: customers,
                            datasets: [{
                                label: 'Average Order Value ($)',
                                data: avgValues,
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 0,
                                borderRadius: 5
                            }]
                        },
                        options: avgOrderValueOptions
                    });
                    avgOrderValueCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Average Order Value Chart.");
                    avgOrderValueCanvas.style.display = 'none';
                }
            }

            // 6. Payment Method Popularity Chart
            const paymentPopularityCanvas = document.getElementById('paymentPopularityChart');
            if (paymentPopularityCanvas) {
                const methods = data.payment_methods_pop;
                const counts = data.order_counts_payment;
                console.log("Payment Popularity Data:", { methods: methods, counts: counts });
                destroyChart('paymentPopularityChart');
                if (methods.length > 0 && counts.length > 0) {
                    charts['paymentPopularityChart'] = new Chart(paymentPopularityCanvas.getContext('2d'), {
                        type: 'pie',
                        data: {
                            labels: methods,
                            datasets: [{
                                label: 'Order Count',
                                data: counts,
                                backgroundColor: [
                                    'rgba(255, 99, 132, 0.7)',
                                    'rgba(54, 162, 235, 0.7)',
                                    'rgba(255, 206, 86, 0.7)',
                                    'rgba(75, 192, 192, 0.7)',
                                    'rgba(153, 102, 255, 0.7)',
                                    'rgba(255, 159, 64, 0.7)'
                                ],
                                borderColor: 'rgba(255, 255, 255, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: paymentPopularityOptions
                    });
                    paymentPopularityCanvas.style.display = 'block';
                } else {
                    console.warn("No data for Payment Popularity Chart.");
                    paymentPopularityCanvas.style.display = 'none';
                }
            }

            // Ensure the page stays at the top after charts are rendered
            window.scrollTo(0, 0);
        })
        .catch(error => {
            console.error("Error fetching dashboard data:", error);
            const errorDiv = document.getElementById('error');
            if (errorDiv) {
                errorDiv.textContent = `Failed to load dashboard data: ${error.message}`;
                errorDiv.style.display = 'block';
            }
            window.scrollTo(0, 0);
        });
}

// Initial fetch of dashboard data with a slight delay to ensure page load
window.addEventListener('load', () => {
    setTimeout(() => {
        fetchDashboardData();
        window.scrollTo(0, 0);
    }, 100);
});