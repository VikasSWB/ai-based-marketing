
// Object to store chart instances
const productCharts = {};

// Function to destroy a chart if it exists
function destroyProductChart(chartKey) {
    if (productCharts[chartKey] && typeof productCharts[chartKey].destroy === 'function') {
        productCharts[chartKey].destroy();
        delete productCharts[chartKey];
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

// Options for Top Products by Revenue chart (Bar Chart)
const topProductsRevenueOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#FFCCBC', // Light orange for orange background
                font: { family: 'Roboto', size: 12 },
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#FFCCBC',
                font: { family: 'Roboto', size: 14 },
                text: 'Product'
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
                borderDash: [5, 5]
            },
            ticks: {
                color: '#FFCCBC',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#FFCCBC',
                font: { family: 'Roboto', size: 14 },
                text: 'Total Revenue ($)'
            }
        }
    }
};

// Options for Product Quantity Sold Over Time chart (Line Chart)
const quantityOverTimeOptions = {
    ...commonOptions,
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                color: '#B2DFDB', // Light teal for teal background
                font: { family: 'Roboto', size: 12 },
                maxTicksLimit: 10,
                maxRotation: 45,
                minRotation: 45
            },
            title: {
                display: true,
                color: '#B2DFDB',
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
                color: '#B2DFDB',
                font: { family: 'Roboto', size: 12 },
                beginAtZero: true
            },
            title: {
                display: true,
                color: '#B2DFDB',
                font: { family: 'Roboto', size: 14 },
                text: 'Quantity Sold'
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

// Function to render the Top Products by Revenue chart
function renderTopProductsRevenueChart(data) {
    const topProductsRevenueCanvas = document.getElementById('topProductsRevenueChart');
    if (topProductsRevenueCanvas) {
        let products = data.product_names_revenue;
        let revenues = data.revenue_values;
        console.log("Top Products by Revenue Data:", { products, revenues });

        // Ensure products and revenues are arrays
        if (!Array.isArray(products)) {
            console.warn("product_names_revenue is not an array, using empty array.");
            products = [];
        }
        if (!Array.isArray(revenues)) {
            console.warn("revenue_values is not an array, using empty array.");
            revenues = [];
        }

        // Ensure lengths match by padding with zeros if necessary
        if (products.length !== revenues.length) {
            console.warn(`Length mismatch: products (${products.length}) vs revenues (${revenues.length}). Adjusting...`);
            const maxLength = Math.max(products.length, revenues.length);
            products = products.slice(0, maxLength);
            revenues = revenues.slice(0, maxLength);
            while (revenues.length < maxLength) revenues.push(0);
            while (products.length < maxLength) products.push('');
        }

        // Convert revenues to numbers
        const numericRevenues = revenues.map(val => {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        });

        // Destroy existing chart
        destroyProductChart('topProductsRevenueChart');

        // Clear the canvas context to ensure a fresh render
        const ctx = topProductsRevenueCanvas.getContext('2d');
        ctx.clearRect(0, 0, topProductsRevenueCanvas.width, topProductsRevenueCanvas.height);
        console.log("Top Products by Revenue Canvas cleared.");

        // Set canvas dimensions explicitly
        topProductsRevenueCanvas.width = 500;
        topProductsRevenueCanvas.height = 200;
        console.log("Top Products by Revenue Canvas dimensions set:", { width: 500, height: 200 });

        if (products.length > 0 && numericRevenues.length > 0) {
            try {
                productCharts['topProductsRevenueChart'] = new Chart(topProductsRevenueCanvas, {
                    type: 'bar',
                    data: {
                        labels: products,
                        datasets: [{
                            label: 'Total Revenue ($)',
                            data: numericRevenues,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 0,
                            borderRadius: 5
                        }]
                    },
                    options: topProductsRevenueOptions
                });
                productCharts['topProductsRevenueChart'].update();
                topProductsRevenueCanvas.style.display = 'block';
                console.log("Top Products by Revenue Chart rendered with data:", { labels: products, data: numericRevenues });
            } catch (error) {
                console.error("Error rendering Top Products by Revenue Chart:", error);
                topProductsRevenueCanvas.style.display = 'none';
            }
        } else {
            console.warn("No valid data for Top Products by Revenue Chart after validation.");
            topProductsRevenueCanvas.style.display = 'none';
        }
    } else {
        console.error("Top Products by Revenue Chart canvas not found.");
    }
}

// Function to render the Product Quantity Sold Over Time chart
function renderQuantityOverTimeChart(data) {
    const quantityOverTimeCanvas = document.getElementById('quantityOverTimeChart');
    if (quantityOverTimeCanvas) {
        let months = data.quantity_months;
        let quantities = data.quantity_values;
        console.log("Product Quantity Over Time Data:", { months, quantities });

        // Ensure months and quantities are arrays
        if (!Array.isArray(months)) {
            console.warn("quantity_months is not an array, using empty array.");
            months = [];
        }
        if (!Array.isArray(quantities)) {
            console.warn("quantity_values is not an array, using empty array.");
            quantities = [];
        }

        // Ensure lengths match by padding with zeros if necessary
        if (months.length !== quantities.length) {
            console.warn(`Length mismatch: months (${months.length}) vs quantities (${quantities.length}). Adjusting...`);
            const maxLength = Math.max(months.length, quantities.length);
            months = months.slice(0, maxLength);
            quantities = quantities.slice(0, maxLength);
            while (quantities.length < maxLength) quantities.push(0);
            while (months.length < maxLength) months.push('');
        }

        // Convert quantities to numbers
        const numericQuantities = quantities.map(val => {
            const num = Number(val);
            return isNaN(num) ? 0 : num;
        });

        // Destroy existing chart
        destroyProductChart('quantityOverTimeChart');

        // Clear the canvas context to ensure a fresh render
        const ctx = quantityOverTimeCanvas.getContext('2d');
        ctx.clearRect(0, 0, quantityOverTimeCanvas.width, quantityOverTimeCanvas.height);
        console.log("Product Quantity Over Time Canvas cleared.");

        // Set canvas dimensions explicitly
        quantityOverTimeCanvas.width = 500;
        quantityOverTimeCanvas.height = 200;
        console.log("Product Quantity Over Time Canvas dimensions set:", { width: 500, height: 200 });

        if (months.length > 0 && numericQuantities.length > 0) {
            try {
                productCharts['quantityOverTimeChart'] = new Chart(quantityOverTimeCanvas, {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: [{
                            label: 'Quantity Sold',
                            data: numericQuantities,
                            borderColor: 'rgba(255, 255, 255, 1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: quantityOverTimeOptions
                });
                productCharts['quantityOverTimeChart'].update();
                quantityOverTimeCanvas.style.display = 'block';
                console.log("Product Quantity Over Time Chart rendered with data:", { labels: months, data: numericQuantities });
            } catch (error) {
                console.error("Error rendering Product Quantity Over Time Chart:", error);
                quantityOverTimeCanvas.style.display = 'none';
            }
        } else {
            console.warn("No valid data for Product Quantity Over Time Chart after validation.");
            quantityOverTimeCanvas.style.display = 'none';
        }
    } else {
        console.error("Product Quantity Over Time Chart canvas not found.");
    }
}

// Function to populate the product dropdown and set up search functionality
function setupProductDropdown(products) {
    const productSearch = document.getElementById('productSearch');
    const productList = document.getElementById('productList');
    let allProducts = ['All Products'].concat(products); // Include "All Products" option
    let filteredProducts = allProducts;

    // Function to render the dropdown list
    function renderDropdownList(items, selectedValue) {
        productList.innerHTML = ''; // Clear existing items
        items.forEach(item => {
            const li = document.createElement('li');
            li.setAttribute('data-value', item);
            li.textContent = item;
            if (item === selectedValue) {
                li.classList.add('selected');
            }
            productList.appendChild(li);
        });
    }

    // Initial render of the dropdown list
    renderDropdownList(allProducts, 'All Products');
    productSearch.value = 'All Products'; // Set default value

    // Show/hide dropdown list on input focus/blur
    productSearch.addEventListener('focus', () => {
        productList.style.display = 'block';
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!productSearch.contains(event.target) && !productList.contains(event.target)) {
            productList.style.display = 'none';
        }
    });

    // Filter products as the user types
    productSearch.addEventListener('input', () => {
        const searchValue = productSearch.value.toLowerCase();
        filteredProducts = allProducts.filter(product => 
            product.toLowerCase().includes(searchValue)
        );
        renderDropdownList(filteredProducts, productSearch.value);
        productList.style.display = 'block';
    });

    // Handle selection by clicking an option
    productList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const selectedProduct = event.target.getAttribute('data-value');
            productSearch.value = selectedProduct;
            productList.style.display = 'none';
            // Fetch data with the selected product and current date range
            const dateRangeOption = document.getElementById('dateRangeOption').value;
            let startDate = document.getElementById('startDate').value;
            let endDate = document.getElementById('endDate').value;

            if (dateRangeOption === 'all') {
                startDate = null;
                endDate = null;
            } else if (!startDate || !endDate) {
                startDate = '2024-04-01';
                endDate = '2025-04-01';
            }

            fetchProductInsightsData(1, startDate, endDate, dateRangeOption, selectedProduct);
        }
    });

    // Handle selection by pressing Enter
    productSearch.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const searchValue = productSearch.value.toLowerCase();
            const matchedProduct = allProducts.find(product => 
                product.toLowerCase() === searchValue
            );
            if (matchedProduct) {
                productSearch.value = matchedProduct;
                productList.style.display = 'none';
                // Fetch data with the selected product and current date range
                const dateRangeOption = document.getElementById('dateRangeOption').value;
                let startDate = document.getElementById('startDate').value;
                let endDate = document.getElementById('endDate').value;

                if (dateRangeOption === 'all') {
                    startDate = null;
                    endDate = null;
                } else if (!startDate || !endDate) {
                    startDate = '2024-04-01';
                    endDate = '2025-04-01';
                }

                fetchProductInsightsData(1, startDate, endDate, dateRangeOption, matchedProduct);
            } else if (filteredProducts.length > 0) {
                // If no exact match, select the first filtered product
                productSearch.value = filteredProducts[0];
                productList.style.display = 'none';
                fetchProductInsightsData(1, startDate, endDate, dateRangeOption, filteredProducts[0]);
            }
        }
    });
}

// Fetch product insights data and populate charts
function fetchProductInsightsData(page = 1, startDate = null, endDate = null, dateRangeOption = 'last_1_year', selectedProduct = null) {
    console.log("Fetching product insights data with parameters:", { page, startDate, endDate, dateRangeOption, selectedProduct });

    // Build the URL with query parameters
    let url = `/product_insights_data/?page=${page}`;
    if (startDate) {
        url += `&start_date=${startDate}`;
    }
    if (endDate) {
        url += `&end_date=${endDate}`;
    }
    url += `&date_range_option=${dateRangeOption}`;
    if (selectedProduct && selectedProduct !== 'All Products') {
        url += `&product=${encodeURIComponent(selectedProduct)}`;
    }
    console.log("Fetching URL:", url);

    fetch(url)
        .then(response => {
            console.log("API Response Status:", response.status);
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
            console.log("Product insights data received:", data);

            // Validate the response data
            if (!data || typeof data !== 'object') {
                console.error("Invalid data format received:", data);
                throw new Error("Invalid data format received from server.");
            }

            // Check for errors in the response
            if (data.error) {
                console.error("Error fetching product insights data:", data.error);
                const errorDiv = document.getElementById('error');
                if (errorDiv) {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
                return;
            }

            // Validate required fields
            const requiredFields = ['product_names_revenue', 'revenue_values', 'quantity_months', 'quantity_values'];
            for (const field of requiredFields) {
                if (!(field in data)) {
                    console.error(`Missing required field in response: ${field}`);
                    throw new Error(`Missing required field in response: ${field}`);
                }
            }

            // Set up the product dropdown (only on the initial load)
            if (!selectedProduct) {
                setupProductDropdown(data.product_list);
            }

            // Update the date range note
            updateDateRangeNote(startDate, endDate, dateRangeOption);

            // Render the charts
            renderTopProductsRevenueChart(data);
            renderQuantityOverTimeChart(data);

            // Force a window resize to ensure Chart.js refreshes the canvas
            window.dispatchEvent(new Event('resize'));
            console.log("Triggered window resize to force chart refresh.");

            // Ensure the page stays at the top after charts are rendered
            window.scrollTo(0, 0);
        })
        .catch(error => {
            console.error("Error fetching product insights data:", error);
            const errorDiv = document.getElementById('error');
            if (errorDiv) {
                errorDiv.textContent = `Failed to load product insights data: ${error.message}`;
                errorDiv.style.display = 'block';
            }
            window.scrollTo(0, 0);
        });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing product insights...");

    // Initial fetch with default 1-year range
    const defaultStartDate = '2024-04-01';
    const defaultEndDate = '2025-04-01';
    fetchProductInsightsData(1, defaultStartDate, defaultEndDate, 'last_1_year');
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
            const selectedProduct = document.getElementById('productSearch').value || 'All Products';

            console.log("Captured filter parameters:", { dateRangeOption, startDate, endDate, selectedProduct });

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

            console.log("Calling fetchProductInsightsData with final parameters:", { page: 1, startDate, endDate, dateRangeOption, selectedProduct });
            fetchProductInsightsData(1, startDate, endDate, dateRangeOption, selectedProduct);
        });
    } else {
        console.error("Apply Filters button not found. Check HTML for 'applyFilters' ID.");
    }
});