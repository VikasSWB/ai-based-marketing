
// Object to store chart instances
const financialCharts = {};

// Function to destroy a chart if it exists
function destroyFinancialChart(chartKey) {
    if (financialCharts[chartKey] && typeof financialCharts[chartKey].destroy === 'function') {
        financialCharts[chartKey].destroy();
        delete financialCharts[chartKey];
        console.log(`Chart ${chartKey} destroyed successfully.`);
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

// Options for Shipping Charges Trend chart
const shippingChargesOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#E8F5E9', // Light green for green background
                font: { family: 'Roboto', size: 12 },
                maxRotation: 45,
                minRotation: 45
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
                text: 'Shipping Charges ($)'
            }
        }
    }
};

// Options for Tax Collected by Month chart
const taxCollectedOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#FFEBEE', // Light red for red background
                font: { family: 'Roboto', size: 12 },
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#FFEBEE',
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
                color: '#FFEBEE',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#FFEBEE',
                font: { family: 'Roboto', size: 14 },
                text: 'Tax Collected ($)'
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

// Fetch financial insights data and populate charts
function fetchFinancialInsightsData(page = 1, startDate = null, endDate = null, dateRangeOption = 'last_1_year') {
    console.log("Fetching financial insights data with parameters:", { page, startDate, endDate, dateRangeOption });

    // Build the URL with query parameters
    let url = `/financial-insights-data/?page=${page}`;
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
            console.log("Financial insights data received:", data);

            // Validate the response data
            if (!data || typeof data !== 'object') {
                console.error("Invalid data format received:", data);
                throw new Error("Invalid data format received from server.");
            }

            // Check for errors in the response
            if (data.error) {
                console.error("Error fetching financial insights data:", data.error);
                const errorDiv = document.getElementById('error');
                if (errorDiv) {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // Validate required fields
            const requiredFields = ['shipping_months', 'shipping_values', 'tax_months', 'tax_values'];
            for (const field of requiredFields) {
                if (!(field in data)) {
                    console.error(`Missing required field in response: ${field}`);
                    throw new Error(`Missing required field in response: ${field}`);
                }
            }

            // Update the date range note
            updateDateRangeNote(startDate, endDate, dateRangeOption);

            // 1. Shipping Charges Trend Chart
            const shippingChargesCanvas = document.getElementById('shippingChargesChart');
            if (shippingChargesCanvas) {
                let months = data.shipping_months;
                let values = data.shipping_values;
                console.log("Shipping Charges Data:", { months, values });

                // Ensure months and values are arrays
                if (!Array.isArray(months)) {
                    console.warn("shipping_months is not an array, using empty array.");
                    months = [];
                }
                if (!Array.isArray(values)) {
                    console.warn("shipping_values is not an array, using empty array.");
                    values = [];
                }

                // Ensure lengths match by padding with zeros if necessary
                if (months.length !== values.length) {
                    console.warn(`Length mismatch: months (${months.length}) vs values (${values.length}). Adjusting...`);
                    const maxLength = Math.max(months.length, values.length);
                    months = months.slice(0, maxLength);
                    values = values.slice(0, maxLength);
                    while (values.length < maxLength) values.push(0);
                    while (months.length < maxLength) months.push('');
                }

                // Convert values to numbers
                const numericValues = values.map(val => {
                    const num = Number(val);
                    return isNaN(num) ? 0 : num;
                });

                // Destroy existing chart
                destroyFinancialChart('shippingChargesChart');

                // Clear the canvas context to ensure a fresh render
                const ctx = shippingChargesCanvas.getContext('2d');
                ctx.clearRect(0, 0, shippingChargesCanvas.width, shippingChargesCanvas.height);
                console.log("Shipping Charges Canvas cleared.");

                // Set canvas dimensions explicitly
                shippingChargesCanvas.width = 500;
                shippingChargesCanvas.height = 200;
                console.log("Shipping Charges Canvas dimensions set:", { width: 500, height: 200 });

                if (months.length > 0 && numericValues.length > 0) {
                    try {
                        financialCharts['shippingChargesChart'] = new Chart(shippingChargesCanvas, {
                            type: 'line',
                            data: {
                                labels: months,
                                datasets: [{
                                    label: 'Shipping Charges ($)',
                                    data: numericValues,
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
                            options: shippingChargesOptions
                        });
                        financialCharts['shippingChargesChart'].update();
                        shippingChargesCanvas.style.display = 'block';
                        console.log("Shipping Charges Chart rendered with data:", { labels: months, data: numericValues });
                    } catch (error) {
                        console.error("Error rendering Shipping Charges Chart:", error);
                        shippingChargesCanvas.style.display = 'none';
                    }
                } else {
                    console.warn("No valid data for Shipping Charges Chart after validation.");
                    shippingChargesCanvas.style.display = 'none';
                }
            } else {
                console.error("Shipping Charges Chart canvas not found.");
            }

            // 2. Tax Collected by Month Chart
            const taxCollectedCanvas = document.getElementById('taxCollectedChart');
            if (taxCollectedCanvas) {
                let months = data.tax_months;
                let values = data.tax_values;
                console.log("Tax Collected Data:", { months, values });

                // Ensure months and values are arrays
                if (!Array.isArray(months)) {
                    console.warn("tax_months is not an array, using empty array.");
                    months = [];
                }
                if (!Array.isArray(values)) {
                    console.warn("tax_values is not an array, using empty array.");
                    values = [];
                }

                // Ensure lengths match by padding with zeros if necessary
                if (months.length !== values.length) {
                    console.warn(`Length mismatch: months (${months.length}) vs values (${values.length}). Adjusting...`);
                    const maxLength = Math.max(months.length, values.length);
                    months = months.slice(0, maxLength);
                    values = values.slice(0, maxLength);
                    while (values.length < maxLength) values.push(0);
                    while (months.length < maxLength) months.push('');
                }

                // Convert values to numbers
                const numericValues = values.map(val => {
                    const num = Number(val);
                    return isNaN(num) ? 0 : num;
                });

                // Destroy existing chart
                destroyFinancialChart('taxCollectedChart');

                // Clear the canvas context to ensure a fresh render
                const ctx = taxCollectedCanvas.getContext('2d');
                ctx.clearRect(0, 0, taxCollectedCanvas.width, taxCollectedCanvas.height);
                console.log("Tax Collected Canvas cleared.");

                // Set canvas dimensions explicitly
                taxCollectedCanvas.width = 500;
                taxCollectedCanvas.height = 200;
                console.log("Tax Collected Canvas dimensions set:", { width: 500, height: 200 });

                if (months.length > 0 && numericValues.length > 0) {
                    try {
                        financialCharts['taxCollectedChart'] = new Chart(taxCollectedCanvas, {
                            type: 'line',
                            data: {
                                labels: months,
                                datasets: [{
                                    label: 'Tax Collected ($)',
                                    data: numericValues,
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
                            options: taxCollectedOptions
                        });
                        financialCharts['taxCollectedChart'].update();
                        taxCollectedCanvas.style.display = 'block';
                        console.log("Tax Collected Chart rendered with data:", { labels: months, data: numericValues });
                    } catch (error) {
                        console.error("Error rendering Tax Collected Chart:", error);
                        taxCollectedCanvas.style.display = 'none';
                    }
                } else {
                    console.warn("No valid data for Tax Collected Chart after validation.");
                    taxCollectedCanvas.style.display = 'none';
                }
            } else {
                console.error("Tax Collected Chart canvas not found.");
            }

            // Force a window resize to ensure Chart.js refreshes the canvas
            window.dispatchEvent(new Event('resize'));
            console.log("Triggered window resize to force chart refresh.");

            // Ensure the page stays at the top after charts are rendered
            window.scrollTo(0, 0);
        })
        .catch(error => {
            console.error("Error fetching financial insights data:", error);
            const errorDiv = document.getElementById('error');
            if (errorDiv) {
                errorDiv.textContent = `Failed to load financial insights data: ${error.message}`;
                errorDiv.style.display = 'block';
            }
            window.scrollTo(0, 0);
        });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing financial insights...");

    // Initial fetch with default 1-year range
    const defaultStartDate = '2024-04-01';
    const defaultEndDate = '2025-04-01';
    fetchFinancialInsightsData(1, defaultStartDate, defaultEndDate, 'last_1_year');
    console.log("Initial fetch completed with default range.");

    // Add event listener for the apply filters button
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        console.log("Apply Filters button found, attaching listener.");
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

            console.log("Calling fetchFinancialInsightsData with final parameters:", { page: 1, startDate, endDate, dateRangeOption });
            fetchFinancialInsightsData(1, startDate, endDate, dateRangeOption);
        });
    } else {
        console.error("Apply Filters button not found. Check HTML for 'applyFilters' ID.");
    }
});