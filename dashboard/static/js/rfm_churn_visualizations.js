
// Object to store chart instances
let rfmSegmentChart = null;
let activeCustomersChart = null;
let aovChart = null;

// Function to destroy charts if they exist
function destroyCharts() {
    if (rfmSegmentChart && typeof rfmSegmentChart.destroy === 'function') {
        rfmSegmentChart.destroy();
        rfmSegmentChart = null;
    }
    if (activeCustomersChart && typeof activeCustomersChart.destroy === 'function') {
        activeCustomersChart.destroy();
        activeCustomersChart = null;
    }
    if (aovChart && typeof aovChart.destroy === 'function') {
        aovChart.destroy();
        aovChart = null;
    }
}

// Common Chart.js options for consistent styling
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, family: 'Roboto' },
            bodyFont: { size: 12, family: 'Roboto' },
            padding: 10,
            cornerRadius: 5
        }
    }
};

// Function to update the date range note
function updateDateRangeNote(startDate, endDate, dateRangeOption) {
    const noteElement = document.getElementById('dateRangeNote');
    if (dateRangeOption === 'all' && !startDate && !endDate) {
        noteElement.textContent = 'Showing all data.';
    } else if (startDate && endDate) {
        noteElement.textContent = `Showing data from ${startDate} to ${endDate}.`;
    } else {
        noteElement.textContent = `Showing data for the last 1 year (${startDate || '2024-04-01'} to ${endDate || '2025-04-01'}).`;
    }
}

// Function to fetch paginated customer data for a specific segment and page
function fetchCustomerData(segment, page, filterSegment, startDate, endDate, dateRangeOption) {
    let url = `/rfm_churn_visualizations_data/?segment=${encodeURIComponent(segment)}&page=${page}`;
    if (filterSegment && filterSegment !== 'All') {
        url += `&filter_segment=${encodeURIComponent(filterSegment)}`;
    }
    if (startDate) {
        url += `&start_date=${startDate}`;
    }
    if (endDate) {
        url += `&end_date=${endDate}`;
    }
    url += `&date_range_option=${dateRangeOption}`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        });
}

// Function to render a customer table for a segment
function renderCustomerTable(segment, customers, pagination, filterSegment, startDate, endDate, dateRangeOption) {
    const table = document.createElement('table');
    table.className = 'customer-table';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Name', 'Email', 'Recency (days)', 'Frequency', 'Monetary ($)', 'Churned', 'Recommended Action'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    customers.forEach(customer => {
        const row = document.createElement('tr');
        const cells = [
            customer.customer_name,
            customer.customer_email || 'N/A',
            customer.recency,
            customer.frequency,
            customer.monetary.toFixed(2),
            customer.Churn,
            customer['Recommended Action']
        ];
        cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    // Pagination controls
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination-controls';
    paginationDiv.style.marginTop = '10px';
    paginationDiv.style.textAlign = 'right';

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${pagination.current_page} of ${pagination.total_pages} (${pagination.total_items} customers)`;
    pageInfo.style.marginRight = '10px';
    paginationDiv.appendChild(pageInfo);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = pagination.current_page === 1;
    prevButton.style.marginRight = '5px';
    prevButton.addEventListener('click', () => {
        if (pagination.current_page > 1) {
            fetchCustomerData(segment, pagination.current_page - 1, filterSegment, startDate, endDate, dateRangeOption).then(data => {
                const segmentDiv = document.getElementById(`segment-${segment.replace(/\s+/g, '-')}`);
                segmentDiv.querySelector('.customer-table').remove();
                segmentDiv.querySelector('.pagination-controls').remove();
                const newTable = renderCustomerTable(segment, data.customer_data[segment], data.pagination_data[segment], filterSegment, startDate, endDate, dateRangeOption);
                segmentDiv.appendChild(newTable);
            });
        }
    });
    paginationDiv.appendChild(prevButton);

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = pagination.current_page === pagination.total_pages;
    nextButton.addEventListener('click', () => {
        if (pagination.current_page < pagination.total_pages) {
            fetchCustomerData(segment, pagination.current_page + 1, filterSegment, startDate, endDate, dateRangeOption).then(data => {
                const segmentDiv = document.getElementById(`segment-${segment.replace(/\s+/g, '-')}`);
                segmentDiv.querySelector('.customer-table').remove();
                segmentDiv.querySelector('.pagination-controls').remove();
                const newTable = renderCustomerTable(segment, data.customer_data[segment], data.pagination_data[segment], filterSegment, startDate, endDate, dateRangeOption);
                segmentDiv.appendChild(newTable);
            });
        }
    });
    paginationDiv.appendChild(nextButton);

    const container = document.createElement('div');
    container.appendChild(table);
    container.appendChild(paginationDiv);
    return container;
}

// Function to fetch visualization data and render charts
function fetchVisualizationData(filterSegment = null, startDate = null, endDate = null, dateRangeOption = 'last_1_year') {
    console.log("Fetching RFM, active customers/orders, AOV, and recommendations data...");

    let url = '/rfm_churn_visualizations_data/';
    const params = new URLSearchParams();
    if (filterSegment && filterSegment !== 'All') {
        params.append('filter_segment', filterSegment);
    }
    if (startDate) {
        params.append('start_date', startDate);
    }
    if (endDate) {
        params.append('end_date', endDate);
    }
    params.append('date_range_option', dateRangeOption);
    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error("Error fetching visualization data:", data.error);
                const errorDiv = document.getElementById('error');
                if (errorDiv) {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
                return;
            }

            console.log("Visualization data received:", data);

            // Destroy existing charts
            destroyCharts();

            // Update the date range note
            updateDateRangeNote(startDate, endDate, dateRangeOption);

            // RFM Segment Pie Chart
            const rfmSegmentCanvas = document.getElementById('rfmSegmentChart');
            if (rfmSegmentCanvas) {
                rfmSegmentChart = new Chart(rfmSegmentCanvas.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: data.segment_data.labels,
                        datasets: [{
                            data: data.segment_data.values,
                            backgroundColor: [
                                '#42A5F5', // Loyal Customer
                                '#66BB6A', // Active Customer
                                '#FFCA28', // Average Customer
                                '#EF5350', // At Risk
                                '#AB47BC'  // New Customer
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: {
                                display: true,
                                position: 'right',
                                labels: {
                                    font: { family: 'Roboto', size: 12 },
                                    color: '#2c3e50'
                                }
                            }
                        }
                    }
                });
            }

            // Active Customers and Orders Chart
            const activeCustomersCanvas = document.getElementById('activeCustomersChart');
            if (activeCustomersCanvas) {
                const labels = data.active_customers_data.labels;
                const displayLabels = labels.map((label, index) => {
                    if (label.endsWith('-01') || label === labels[0]) {
                        return label;
                    }
                    return '';
                });

                activeCustomersChart = new Chart(activeCustomersCanvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Active Customers',
                                data: data.active_customers_data.active_customers,
                                backgroundColor: 'rgba(66, 165, 245, 0.5)',
                                borderColor: '#42A5F5',
                                fill: true,
                                tension: 0.4,
                                yAxisID: 'y'
                            },
                            {
                                label: 'Total Orders',
                                data: data.active_customers_data.orders,
                                borderColor: '#FF9800',
                                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                                fill: false,
                                tension: 0.4,
                                yAxisID: 'y1',
                                pointRadius: 3,
                                pointBackgroundColor: '#FF9800'
                            }
                        ]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            annotation: labels.includes('2024-11') ? {
                                annotations: {
                                    label1: {
                                        type: 'label',
                                        xValue: '2024-11',
                                        yValue: data.active_customers_data.active_customers[labels.indexOf('2024-11')],
                                        content: ['Surge in active customers'],
                                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                        color: 'white',
                                        font: { size: 12, family: 'Roboto' },
                                        position: 'center',
                                        yAdjust: -20
                                    }
                                }
                            } : {}
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 12 },
                                    maxRotation: 45,
                                    minRotation: 45,
                                    callback: function(value, index) {
                                        return displayLabels[index];
                                    }
                                },
                                title: {
                                    display: true,
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 14 },
                                    text: 'Year-Month'
                                }
                            },
                            y: {
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)',
                                    borderDash: [5, 5]
                                },
                                ticks: {
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 12 },
                                    beginAtZero: true
                                },
                                title: {
                                    display: true,
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 14 },
                                    text: 'Active Customers'
                                }
                            },
                            y1: {
                                position: 'right',
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 12 },
                                    beginAtZero: true
                                },
                                title: {
                                    display: true,
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 14 },
                                    text: 'Total Orders'
                                }
                            }
                        }
                    }
                });
            }

            // Average Order Value Over Time Chart
            const aovCanvas = document.getElementById('aovChart');
            if (aovCanvas) {
                const labels = data.active_customers_data.labels;
                const displayLabels = labels.map((label, index) => {
                    if (label.endsWith('-01') || label === labels[0]) {
                        return label;
                    }
                    return '';
                });

                aovChart = new Chart(aovCanvas.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Average Order Value ($)',
                            data: data.active_customers_data.avg_order_value,
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointBackgroundColor: '#4CAF50'
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            annotation: labels.includes('2024-11') ? {
                                annotations: {
                                    label1: {
                                        type: 'label',
                                        xValue: '2024-11',
                                        yValue: data.active_customers_data.avg_order_value[labels.indexOf('2024-11')],
                                        content: ['AOV after customer surge'],
                                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                        color: 'white',
                                        font: { size: 12, family: 'Roboto' },
                                        position: 'center',
                                        yAdjust: -20
                                    }
                                }
                            } : {}
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 12 },
                                    maxRotation: 45,
                                    minRotation: 45,
                                    callback: function(value, index) {
                                        return displayLabels[index];
                                    }
                                },
                                title: {
                                    display: true,
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 14 },
                                    text: 'Year-Month'
                                }
                            },
                            y: {
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)',
                                    borderDash: [5, 5]
                                },
                                ticks: {
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 12 },
                                    beginAtZero: true,
                                    callback: function(value) {
                                        return '$' + value;
                                    }
                                },
                                title: {
                                    display: true,
                                    color: '#6c757d',
                                    font: { family: 'Roboto', size: 14 },
                                    text: 'Average Order Value ($)'
                                }
                            }
                        }
                    }
                });
            }

            // Populate Customer Recommendations with Pagination
            const recommendationsSection = document.getElementById('recommendations-section');
            if (recommendationsSection) {
                recommendationsSection.innerHTML = '';

                const segments = Object.keys(data.customer_data).sort();
                segments.forEach(segment => {
                    const customers = data.customer_data[segment];
                    const recommendation = data.recommendations[segment] || 'No action specified.';
                    const pagination = data.pagination_data[segment];

                    const card = document.createElement('div');
                    card.className = 'recommendation-card';
                    card.id = `segment-${segment.replace(/\s+/g, '-')}`;

                    const title = document.createElement('h4');
                    title.textContent = `${segment} (${pagination.total_items} customers)`;
                    card.appendChild(title);

                    const recText = document.createElement('p');
                    recText.textContent = `Recommendation: ${recommendation}`;
                    card.appendChild(recText);

                    const tableContainer = renderCustomerTable(segment, customers, pagination, filterSegment, startDate, endDate, dateRangeOption);
                    card.appendChild(tableContainer);

                    recommendationsSection.appendChild(card);
                });
            }

            // Scroll to top
            window.scrollTo(0, 0);
        })
        .catch(error => {
            console.error("Error fetching visualization data:", error);
            const errorDiv = document.getElementById('error');
            if (errorDiv) {
                errorDiv.textContent = `Failed to load visualization data: ${error.message}`;
                errorDiv.style.display = 'block';
            }
            window.scrollTo(0, 0);
        });
}

// Fetch data and render charts on page load with default 1-year range
window.addEventListener('load', () => {
    setTimeout(() => {
        const defaultStartDate = '2024-04-01';
        const defaultEndDate = '2025-04-01';
        fetchVisualizationData(null, defaultStartDate, defaultEndDate, 'last_1_year');
        window.scrollTo(0, 0);
    }, 100);
});

// Apply filters when the button is clicked
document.getElementById('applyFilters').addEventListener('click', () => {
    const filterSegment = document.getElementById('filterSegment').value;
    const dateRangeOption = document.getElementById('dateRangeOption').value;
    let startDate = document.getElementById('startDate').value;
    let endDate = document.getElementById('endDate').value;

    // If "All Data" is selected, clear the start and end dates to use the full range
    if (dateRangeOption === 'all') {
        startDate = null;
        endDate = null;
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert('Start date must be before end date.');
        return;
    }

    fetchVisualizationData(filterSegment, startDate, endDate, dateRangeOption);
});