
// Function to render the cohort revenue matrix
function renderCohortMatrix(cohorts, revenueMatrix, monthLabels) {
    const header = document.getElementById('cohortMatrixHeader');
    const body = document.getElementById('cohortMatrixBody');
    if (!header || !body) {
        console.error("Cohort Matrix elements not found.");
        return;
    }

    // Render header
    header.innerHTML = '<th>Date of First Order</th><th>New Customers</th>';
    monthLabels.forEach(label => {
        header.innerHTML += `<th>${label}</th>`;
    });
    console.log("Received monthLabels:", monthLabels); // Debug to verify 12 months

    // Render body
    body.innerHTML = '';
    cohorts.forEach((cohort, i) => {
        const row = document.createElement('tr');
        const newCustomers = revenueMatrix[i][0].toLocaleString(); // First column is new customers
        row.innerHTML = `<td>${cohort}</td><td>${newCustomers}</td>`;
        const revenueData = revenueMatrix[i].slice(2); // Get all 12 months
        if (revenueData.length < 12) {
            console.error(`Revenue data for ${cohort} has only ${revenueData.length} months, expected 12. Padding with 0.`);
            while (revenueData.length < 12) revenueData.push(0); // Pad with zeros if less than 12
        }
        revenueData.forEach((revenue, j) => {
            const cell = document.createElement('td');
            cell.className = 'heatmap-cell';
            cell.textContent = `$${revenue.toLocaleString() || '0'}`;
            // Set static colors based on new revenue ranges
            let backgroundColor = '#E0E0E0'; // Default light gray for zero
            let textColor = '#000000'; // Default black text
            if (revenue >= 5000) {
                backgroundColor = '#00CC00'; // Green for high revenue ($5000+)
            } else if (revenue >= 1000) {
                backgroundColor = '#99FF99'; // Light green for medium revenue ($1000-$4999)
            } else if (revenue >= 500) {
                backgroundColor = '#FFFF99'; // Yellow for low revenue ($500-$999)
            } else if (revenue > 0) {
                backgroundColor = '#FF9900'; // Orange for very low or new cohorts ($1-$499)
            }
            cell.style.backgroundColor = backgroundColor;
            cell.style.color = textColor;
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}
// [Rest of the file remains unchanged - keeping all other functions as they are]

// Function to render the cohort metrics table
function renderCohortMetrics(cohortMetrics) {
    const body = document.getElementById('cohortMetricsBody');
    if (!body) {
        console.error("Cohort Metrics Body element not found.");
        return;
    }
    body.innerHTML = '';

    console.log("Received cohortMetrics:", cohortMetrics); // Debug to check data

    if (cohortMetrics.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align: center;">No cohort metrics data available.</td>`;
        body.appendChild(row);
    } else {
        cohortMetrics.forEach(metric => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${metric.cohort}</td>
                <td>${metric.cohort_size}</td>
                <td>${metric.purchase_frequency}</td>
                <td>${metric.aov}</td>
                <td>${metric.revenue_per_customer}</td>
                <td>${metric.ltv}</td>
            `;
            body.appendChild(row);
        });
    }
}

// Function to render pagination controls
function renderPagination(totalPages, currentPage) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) {
        const container = document.querySelector('.table-container:last-child');
        const paginationDiv = document.createElement('div');
        paginationDiv.id = 'pagination';
        paginationDiv.className = 'pagination';
        container.appendChild(paginationDiv);
    }
    const pagination = document.getElementById('pagination');
    if (!pagination) {
        console.error("Pagination container not found.");
        return;
    }
    pagination.innerHTML = '';

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => fetchCohortData(currentPage - 1);
    pagination.appendChild(prevButton);

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        const firstPage = document.createElement('span');
        firstPage.textContent = '1';
        firstPage.onclick = () => fetchCohortData(1);
        pagination.appendChild(firstPage);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'ellipsis';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageSpan = document.createElement('span');
        pageSpan.textContent = i;
        pageSpan.className = i === currentPage ? 'active' : '';
        pageSpan.onclick = () => fetchCohortData(i);
        pagination.appendChild(pageSpan);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'ellipsis';
            pagination.appendChild(ellipsis);
        }
        const lastPage = document.createElement('span');
        lastPage.textContent = totalPages;
        lastPage.onclick = () => fetchCohortData(totalPages);
        pagination.appendChild(lastPage);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => fetchCohortData(currentPage + 1);
    pagination.appendChild(nextButton);
}

// Function to export cohort data as CSV
function exportCohortData(exportData) {
    const csvRows = [];
    csvRows.push('Cohort,Customer Email');

    for (const cohort in exportData) {
        exportData[cohort].forEach(email => {
            csvRows.push(`"${cohort}","${email}"`);
        });
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'cohort_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to fetch cohort data
function fetchCohortData(page = 1) {
    const dateRangeOption = document.getElementById('dateRangeOption').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const errorElement = document.getElementById('error');

    let url = `/cohort-data/?page=${page}`;
    if (dateRangeOption) url += `&date_range_option=${dateRangeOption}`;
    if (startDate && dateRangeOption !== 'all') url += `&start_date=${startDate}`;
    if (endDate && dateRangeOption !== 'all') url += `&end_date=${endDate}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                errorElement.textContent = data.error;
                errorElement.style.display = 'block';
                return;
            }

            errorElement.style.display = 'none';
            updateDateRangeNote(startDate, endDate, dateRangeOption);
            renderCohortMatrix(data.cohorts, data.revenue_matrix, data.month_labels);
            renderCohortMetrics(data.cohort_metrics);
            renderPagination(data.total_pages, data.current_page);

            const exportButton = document.getElementById('exportCohortData');
            exportButton.onclick = () => exportCohortData(data.export_data);
        })
        .catch(error => {
            console.error('Error fetching cohort data:', error);
            errorElement.textContent = `Error fetching data: ${error.message}. Check server logs.`;
            errorElement.style.display = 'block';
        });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    fetchCohortData();

    const applyFiltersButton = document.getElementById('applyFilters');
    applyFiltersButton.addEventListener('click', () => fetchCohortData());
});