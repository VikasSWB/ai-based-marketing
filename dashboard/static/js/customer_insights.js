
// Object to store chart instances
const customerCharts = {};

// Function to destroy a chart if it exists
function destroyCustomerChart(chartKey) {
    if (customerCharts[chartKey] && typeof customerCharts[chartKey].destroy === 'function') {
        customerCharts[chartKey].destroy();
        delete customerCharts[chartKey];
        console.log(`Chart ${chartKey} destroyed.`);
    } else {
        console.log(`Chart ${chartKey} not found or already destroyed.`);
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

// Options for Top Customers by Total Orders chart (Bar Chart)
const topCustomersOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#BBDEFB', // Light blue for blue background
                font: { family: 'Roboto', size: 12 },
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#BBDEFB',
                font: { family: 'Roboto', size: 14 },
                text: 'Customer'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#BBDEFB',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#BBDEFB',
                font: { family: 'Roboto', size: 14 },
                text: 'Total Orders'
            }
        }
    }
};

// Options for Customer Order Trend Over Time chart (Line Chart)
const orderTrendOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#C8E6C9', // Light green for green background
                font: { family: 'Roboto', size: 12 },
                maxTicksLimit: 10,
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#C8E6C9',
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
                color: '#C8E6C9',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#C8E6C9',
                font: { family: 'Roboto', size: 14 },
                text: 'Total Orders'
            }
        }
    }
};

// Function to update the date range note
function updateDateRangeNote(startDate, endDate, dateRangeOption) {
    const noteElement = document.getElementById('dateRangeNote');
    if (noteElement) {
        if (dateRangeOption === 'all' && !startDate && !endDate) {
            noteElement.textContent = 'Showing all data.';
        } else if (startDate && endDate) {
            noteElement.textContent = `Showing data from ${startDate} to ${endDate}.`;
        } else {
            noteElement.textContent = `Showing data for the last 1 year (${startDate || '2024-04-01'} to ${endDate || '2025-04-01'}).`;
        }
        console.log("Date range note updated:", noteElement.textContent);
    } else {
        console.error("Date range note element not found.");
    }
}

// Function to populate the customer details table
function populateCustomerTable(customers) {
    const tableBody = document.getElementById('customerTableBody');
    if (tableBody) {
        tableBody.innerHTML = ''; // Clear existing rows
        customers.forEach(customer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${customer.customer_name}</td>
                <td data-full-email="${customer.customer_email}">${customer.customer_email}</td>
                <td>${customer.total_orders}</td>
            `;
            tableBody.appendChild(row);
        });
        console.log("Customer table populated with data:", customers);
    } else {
        console.error("Customer table body element not found.");
    }
}

// Function to populate the order range dropdown
function populateOrderRangeDropdown(ranges) {
    const orderRangeSelect = document.getElementById('orderRangeSelect');
    if (orderRangeSelect) {
        orderRangeSelect.innerHTML = ''; // Clear existing options
        ranges.forEach(range => {
            const option = document.createElement('option');
            option.value = `${range.min}-${range.max}`;
            option.textContent = `${range.min} - ${range.max} Orders`;
            orderRangeSelect.appendChild(option);
        });
        console.log("Order range dropdown populated with ranges:", ranges);
    } else {
        console.error("Order range select element not found.");
    }
}

// Function to render pagination controls
function renderPagination(totalPages, currentPage, minOrders, maxOrders, startDate, endDate, dateRangeOption) {
    const pagination = document.getElementById('pagination');
    if (pagination) {
        pagination.innerHTML = ''; // Clear existing controls

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchCustomerInsightsData(currentPage - 1, minOrders, maxOrders, startDate, endDate, dateRangeOption);
            }
        });
        pagination.appendChild(prevButton);

        // Calculate the range of page numbers to display (show 5 pages at a time)
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        // Adjust startPage if endPage is at the maximum
        if (endPage === totalPages) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        // Add ellipsis at the start if needed
        if (startPage > 1) {
            const firstPage = document.createElement('span');
            firstPage.textContent = '1';
            firstPage.addEventListener('click', () => fetchCustomerInsightsData(1, minOrders, maxOrders, startDate, endDate, dateRangeOption));
            pagination.appendChild(firstPage);

            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'ellipsis';
                pagination.appendChild(ellipsis);
            }
        }

        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            const pageSpan = document.createElement('span');
            pageSpan.textContent = i;
            if (i === currentPage) {
                pageSpan.className = 'active';
            } else {
                pageSpan.addEventListener('click', () => fetchCustomerInsightsData(i, minOrders, maxOrders, startDate, endDate, dateRangeOption));
            }
            pagination.appendChild(pageSpan);
        }

        // Add ellipsis at the end if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'ellipsis';
                pagination.appendChild(ellipsis);
            }

            const lastPage = document.createElement('span');
            lastPage.textContent = totalPages;
            lastPage.addEventListener('click', () => fetchCustomerInsightsData(totalPages, minOrders, maxOrders, startDate, endDate, dateRangeOption));
            pagination.appendChild(lastPage);
        }

        // Next button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchCustomerInsightsData(currentPage + 1, minOrders, maxOrders, startDate, endDate, dateRangeOption);
            }
        });
        pagination.appendChild(nextButton);

        console.log(`Pagination rendered: Total Pages=${totalPages}, Current Page=${currentPage}, Displayed Pages=${startPage}-${endPage}`);
    } else {
        console.error("Pagination element not found.");
    }
}

// Fetch customer insights data and populate charts and table
function fetchCustomerInsightsData(page = 1, minOrders = 0, maxOrders = null, startDate = null, endDate = null, dateRangeOption = 'last_1_year') {
    console.log("Fetching customer insights data with parameters:", { page, minOrders, maxOrders, startDate, endDate, dateRangeOption });

    // Build the URL with query parameters
    let url = `/customer_insights_data/?page=${page}`;
    if (minOrders !== null) {
        url += `&min_orders=${minOrders}`;
    }
    if (maxOrders !== null) {
        url += `&max_orders=${maxOrders}`;
    }
    if (startDate) {
        url += `&start_date=${startDate}`;
    }
    if (endDate) {
        url += `&end_date=${endDate}`;
    }
    url += `&date_range_option=${dateRangeOption}`;
    console.log("Fetching URL:", url);

    fetch(url)
        .then(response => {
            console.log("API Response Status:", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Customer insights data received:", data);

            // Check for errors in the response
            if (data.error) {
                console.error("Error fetching customer insights data:", data.error);
                const errorDiv = document.getElementById('error');
                if (errorDiv) {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // Update the date range note
            updateDateRangeNote(startDate, endDate, dateRangeOption);

            // Populate the order range dropdown (only on the initial load)
            const orderRangeSelect = document.getElementById('orderRangeSelect');
            if (page === 1 && (!orderRangeSelect || !orderRangeSelect.value)) {
                populateOrderRangeDropdown(data.order_ranges);
            }

            // 1. Top Customers by Total Orders Chart (Bar Chart)
            const topCustomersCanvas = document.getElementById('topCustomersChart');
            if (topCustomersCanvas) {
                const customers = data.customer_names;
                const orders = data.total_orders;
                console.log("Top Customers Data:", { customers, orders });
                destroyCustomerChart('topCustomersChart');
                if (customers && customers.length > 0 && orders && orders.length > 0) {
                    customerCharts['topCustomersChart'] = new Chart(topCustomersCanvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: customers,
                            datasets: [{
                                label: 'Total Orders',
                                data: orders,
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 0,
                                borderRadius: 5
                            }]
                        },
                        options: topCustomersOptions
                    });
                    topCustomersCanvas.style.display = 'block';
                    console.log("Top Customers Chart rendered with data:", { labels: customers, data: orders });
                } else {
                    console.warn("No data for Top Customers Chart.");
                    topCustomersCanvas.style.display = 'none';
                }
            } else {
                console.error("Top Customers Chart canvas not found.");
            }

            // 2. Customer Order Trend Over Time Chart (Line Chart)
            const orderTrendCanvas = document.getElementById('orderTrendChart');
            if (orderTrendCanvas) {
                const months = data.order_months;
                const orders = data.order_values;
                console.log("Order Trend Data:", { months, orders });
                destroyCustomerChart('orderTrendChart');
                if (months && months.length > 0 && orders && orders.length > 0) {
                    customerCharts['orderTrendChart'] = new Chart(orderTrendCanvas.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: months,
                            datasets: [{
                                label: 'Total Orders',
                                data: orders,
                                borderColor: 'rgba(255, 255, 255, 1)',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: orderTrendOptions
                    });
                    orderTrendCanvas.style.display = 'block';
                    console.log("Order Trend Chart rendered with data:", { labels: months, data: orders });
                } else {
                    console.warn("No data for Order Trend Chart.");
                    orderTrendCanvas.style.display = 'none';
                }
            } else {
                console.error("Order Trend Chart canvas not found.");
            }

            // 3. Populate Customer Details Table
            populateCustomerTable(data.customer_details);

            // 4. Render Pagination Controls
            renderPagination(data.total_pages, data.current_page, minOrders, maxOrders, startDate, endDate, dateRangeOption);

            // Ensure the page stays at the top after rendering
            window.scrollTo(0, 0);
        })
        .catch(error => {
            console.error("Error fetching customer insights data:", error);
            const errorDiv = document.getElementById('error');
            if (errorDiv) {
                errorDiv.textContent = `Failed to load customer insights data: ${error.message}`;
                errorDiv.style.display = 'block';
            }
            window.scrollTo(0, 0);
        });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing customer insights...");

    // Initial fetch with default 1-year range
    const defaultStartDate = '2024-04-01';
    const defaultEndDate = '2025-04-01';
    fetchCustomerInsightsData(1, 0, null, defaultStartDate, defaultEndDate, 'last_1_year');

    // Add event listener for the order range dropdown
    const orderRangeSelect = document.getElementById('orderRangeSelect');
    if (orderRangeSelect) {
        orderRangeSelect.addEventListener('change', () => {
            console.log("Order range dropdown changed.");
            const dateRangeOption = document.getElementById('dateRangeOption').value;
            let startDate = document.getElementById('startDate').value;
            let endDate = document.getElementById('endDate').value;
            if (dateRangeOption === 'all') {
                startDate = null;
                endDate = null;
            }
            const [minOrders, maxOrders] = orderRangeSelect.value.split('-').map(Number);
            fetchCustomerInsightsData(1, minOrders, maxOrders, startDate, endDate, dateRangeOption);
        });
    } else {
        console.error("Order range select element not found.");
    }

    // Add event listener for the apply filters button
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            console.log("Apply Filters button clicked.");
            const dateRangeOption = document.getElementById('dateRangeOption').value;
            let startDate = document.getElementById('startDate').value;
            let endDate = document.getElementById('endDate').value;

            console.log("Captured filter parameters:", { dateRangeOption, startDate, endDate });

            // If "All Data" is selected, clear the start and end dates
            if (dateRangeOption === 'all') {
                startDate = null;
                endDate = null;
                console.log("All Data selected, clearing startDate and endDate.");
            }

            // Validate dates if provided
            if (startDate && endDate) {
                if (new Date(startDate) > new Date(endDate)) {
                    alert('Start date must be before end date.');
                    console.log("Validation failed: Start date is after end date.");
                    return;
                }
            } else if (dateRangeOption !== 'all' && (!startDate || !endDate)) {
                console.log("Using default dates since startDate or endDate is empty.");
                startDate = '2024-04-01';
                endDate = '2025-04-01';
            }

            // Get the selected order range
            const orderRangeSelect = document.getElementById('orderRangeSelect');
            let minOrders = 0;
            let maxOrders = null;
            if (orderRangeSelect && orderRangeSelect.value) {
                const [min, max] = orderRangeSelect.value.split('-').map(Number);
                minOrders = min;
                maxOrders = max;
            }

            console.log("Calling fetchCustomerInsightsData with final parameters:", { page: 1, minOrders, maxOrders, startDate, endDate, dateRangeOption });
            fetchCustomerInsightsData(1, minOrders, maxOrders, startDate, endDate, dateRangeOption);
        });
    } else {
        console.error("Apply Filters button not found.");
    }
});