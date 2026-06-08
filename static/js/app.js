const API_BASE = '';

let phBarChart = null;
let phDiffScatterChart = null;
let groupLayoutChart = null;
let trendChart = null;

let currentFilters = {
    group: '',
    startDate: '',
    endDate: ''
};

let selectedPonds = [];
const MAX_SELECTED = 3;

let cachedData = {
    periodAverages: [],
    adjacentPhDiff: [],
    dailyAverages: [],
    summary: null,
    groupLayout: null
};

const GROUP_COLORS = {
    'A组': '#667eea',
    'B组': '#f093fb',
    'C组': '#4facfe',
    'D组': '#43e97b',
    'E组': '#fa709a',
    'F组': '#fee140'
};

(function() {
    initCharts();
    loadInitialData();
    setupEventListeners();
})();

function initCharts() {
    phBarChart = echarts.init(document.getElementById('phBarChart'));
    phDiffScatterChart = echarts.init(document.getElementById('phDiffScatterChart'));
    groupLayoutChart = echarts.init(document.getElementById('groupLayoutChart'));
    trendChart = echarts.init(document.getElementById('trendChart'));

    window.addEventListener('resize', function() {
        phBarChart.resize();
        phDiffScatterChart.resize();
        groupLayoutChart.resize();
        trendChart.resize();
    });
}

function setupEventListeners() {
    document.addEventListener('click', function(e) {
        const exportMenu = document.getElementById('exportMenu');
        const exportBtn = e.target.closest('.btn-info');
        if (!exportBtn && !exportMenu.contains(e.target)) {
            exportMenu.classList.remove('active');
        }
    });
}

function togglePondSelection(pondId, isMultiSelect) {
    const idx = selectedPonds.indexOf(pondId);
    if (idx !== -1) {
        selectedPonds.splice(idx, 1);
    } else {
        if (!isMultiSelect) {
            selectedPonds = [];
        }
        if (selectedPonds.length >= MAX_SELECTED) {
            showToast(`最多只能选中 ${MAX_SELECTED} 个池`, 'error');
            return;
        }
        selectedPonds.push(pondId);
    }
    updateClearFocusBtn();
    refreshAllFocusedViews();
}

function clearFocus() {
    if (selectedPonds.length > 0) {
        selectedPonds = [];
        updateClearFocusBtn();
        refreshAllFocusedViews();
        showToast('已清除聚焦', 'info');
    }
}

function updateClearFocusBtn() {
    const btn = document.getElementById('clearFocusBtn');
    const periodHint = document.getElementById('periodFocusHint');
    const adjacentHint = document.getElementById('adjacentFocusHint');
    const summaryHint = document.getElementById('summaryFocusHint');

    if (selectedPonds.length > 0) {
        const hintText = `已聚焦: ${selectedPonds.join('、')}`;
        if (btn) {
            btn.style.display = 'inline-flex';
            btn.innerHTML = `❌ 清除聚焦 <span class="focus-badge">${selectedPonds.length}</span>`;
        }
        if (periodHint) {
            periodHint.textContent = hintText;
            periodHint.style.display = 'inline-block';
        }
        if (adjacentHint) {
            adjacentHint.textContent = hintText;
            adjacentHint.style.display = 'inline-block';
        }
        if (summaryHint) {
            summaryHint.textContent = hintText;
            summaryHint.style.display = 'inline-block';
        }
    } else {
        if (btn) {
            btn.style.display = 'none';
        }
        if (periodHint) {
            periodHint.style.display = 'none';
        }
        if (adjacentHint) {
            adjacentHint.style.display = 'none';
        }
        if (summaryHint) {
            summaryHint.style.display = 'none';
        }
    }
}

function refreshAllFocusedViews() {
    renderPeriodTable(cachedData.periodAverages);
    renderPhBarChart(cachedData.periodAverages);
    renderAdjacentTable(cachedData.adjacentPhDiff);
    renderPhDiffScatterChart(cachedData.adjacentPhDiff);
    renderTrendChart(cachedData.dailyAverages);
    renderGroupLayoutChart(cachedData.groupLayout);
    recalculateSummary();
}

function recalculateSummary() {
    if (!cachedData.periodAverages || cachedData.periodAverages.length === 0) {
        return;
    }

    let data = cachedData.periodAverages;
    if (selectedPonds.length > 0) {
        data = data.filter(row => selectedPonds.includes(row['池号']));
    }

    if (data.length === 0) {
        return;
    }

    const totalPonds = data.length;
    const totalRecords = data.reduce((sum, row) => sum + (row['记录天数'] || 0), 0);
    const avgPh = (data.reduce((sum, row) => sum + (parseFloat(row['期内pH均值']) || 0), 0) / totalPonds).toFixed(2);
    const avgLevel = (data.reduce((sum, row) => sum + (parseFloat(row['期内液位均值']) || 0), 0) / totalPonds).toFixed(1);

    const adjacentData = selectedPonds.length > 0
        ? cachedData.adjacentPhDiff.filter(row =>
            selectedPonds.includes(row['池号1']) || selectedPonds.includes(row['池号2'])
        )
        : cachedData.adjacentPhDiff;

    let maxPhDiff = '0';
    let avgPhDiff = '0';
    if (adjacentData && adjacentData.length > 0) {
        const diffs = adjacentData.map(row => parseFloat(row['pH差值']) || 0);
        maxPhDiff = Math.max(...diffs).toFixed(2);
        avgPhDiff = (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2);
    }

    document.getElementById('totalPonds').textContent = totalPonds;
    document.getElementById('totalRecords').textContent = totalRecords;
    document.getElementById('avgPh').textContent = avgPh;
    document.getElementById('avgLevel').textContent = avgLevel;
    document.getElementById('maxPhDiff').textContent = maxPhDiff;
    document.getElementById('avgPhDiff').textContent = avgPhDiff;
}

function validateSelectedPondsInNewData(newPonds) {
    const pondsSet = new Set(newPonds);
    const removedPonds = selectedPonds.filter(p => !pondsSet.has(p));
    if (removedPonds.length > 0) {
        selectedPonds = selectedPonds.filter(p => pondsSet.has(p));
        updateClearFocusBtn();
        showToast(`池号 ${removedPonds.join('、')} 不在新查询结果中，已取消选中`, 'info');
    }
}

async function loadInitialData() {
    try {
        const [groupsRes, dateRangeRes, pondsRes] = await Promise.all([
            fetch(`${API_BASE}/api/groups`),
            fetch(`${API_BASE}/api/date-range`),
            fetch(`${API_BASE}/api/ponds`)
        ]);

        const groups = await groupsRes.json();
        const dateRange = await dateRangeRes.json();
        const ponds = await pondsRes.json();

        if (groups.success) {
            const select = document.getElementById('groupSelect');
            groups.data.forEach(g => {
                const option = document.createElement('option');
                option.value = g;
                option.textContent = g;
                select.appendChild(option);
            });
        }

        if (dateRange.success) {
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            startInput.value = dateRange.data.min_date;
            endInput.value = dateRange.data.max_date;
            startInput.min = dateRange.data.min_date;
            startInput.max = dateRange.data.max_date;
            endInput.min = dateRange.data.min_date;
            endInput.max = dateRange.data.max_date;
        }

        if (ponds.success) {
            const pondSelect = document.getElementById('manualPond');
            ponds.data.forEach(p => {
                const option = document.createElement('option');
                option.value = p['池号'];
                option.textContent = `${p['池号']} (${p['所在组']})`;
                pondSelect.appendChild(option);
            });
        }

        currentFilters.startDate = dateRange.data.min_date;
        currentFilters.endDate = dateRange.data.max_date;

        loadData();
    } catch (error) {
        showToast('加载初始数据失败', 'error');
        console.error(error);
    }
}

function loadData() {
    currentFilters.group = document.getElementById('groupSelect').value;
    currentFilters.startDate = document.getElementById('startDate').value;
    currentFilters.endDate = document.getElementById('endDate').value;

    if (currentFilters.startDate && currentFilters.endDate && currentFilters.startDate > currentFilters.endDate) {
        showToast('起始日期不能大于结束日期', 'error');
        return;
    }

    Promise.all([
        fetchSummary(),
        fetchPeriodAverages(),
        fetchAdjacentPhDiff(),
        fetchDailyAverages(),
        fetchGroupLayout()
    ]);
}

async function fetchSummary() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/summary?${params}`);
        const data = await res.json();

        if (data.success) {
            cachedData.summary = data.data;
            if (selectedPonds.length === 0) {
                document.getElementById('totalPonds').textContent = data.data.total_ponds;
                document.getElementById('totalRecords').textContent = data.data.total_records;
                document.getElementById('avgPh').textContent = data.data.avg_ph;
                document.getElementById('avgLevel').textContent = data.data.avg_level;
                document.getElementById('maxPhDiff').textContent = data.data.max_ph_diff;
                document.getElementById('avgPhDiff').textContent = data.data.avg_ph_diff;
            }
        }
    } catch (error) {
        console.error('获取汇总数据失败:', error);
    }
}

async function fetchPeriodAverages() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/period-averages?${params}`);
        const data = await res.json();

        if (data.success) {
            const newPonds = data.data.map(row => row['池号']);
            validateSelectedPondsInNewData(newPonds);
            cachedData.periodAverages = data.data;
            renderPeriodTable(data.data);
            renderPhBarChart(data.data);
            if (selectedPonds.length > 0) {
                recalculateSummary();
            }
        }
    } catch (error) {
        console.error('获取期内统计失败:', error);
    }
}

async function fetchAdjacentPhDiff() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/adjacent-ph-diff?${params}`);
        const data = await res.json();

        if (data.success) {
            cachedData.adjacentPhDiff = data.data;
            renderAdjacentTable(data.data);
            renderPhDiffScatterChart(data.data);
            if (selectedPonds.length > 0) {
                recalculateSummary();
            }
        }
    } catch (error) {
        console.error('获取邻池pH差值失败:', error);
    }
}

async function fetchDailyAverages() {
    try {
        const params = new URLSearchParams(currentFilters);
        const res = await fetch(`${API_BASE}/api/daily-averages?${params}`);
        const data = await res.json();

        if (data.success) {
            cachedData.dailyAverages = data.data;
            renderTrendChart(data.data);
        }
    } catch (error) {
        console.error('获取日均数据失败:', error);
    }
}

async function fetchGroupLayout() {
    try {
        const res = await fetch(`${API_BASE}/api/group-layout`);
        const data = await res.json();

        if (data.success) {
            cachedData.groupLayout = data.data;
            renderGroupLayoutChart(data.data);
        }
    } catch (error) {
        console.error('获取池组布局失败:', error);
    }
}

function renderPeriodTable(data) {
    const tbody = document.querySelector('#periodTable tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        const pondId = row['池号'];
        if (selectedPonds.includes(pondId)) {
            tr.classList.add('selected');
        }
        tr.innerHTML = `
            <td><strong>${row['池号']}${selectedPonds.includes(pondId) ? ' <span class="focus-badge">已选</span>' : ''}</strong></td>
            <td>${row['所在组']}</td>
            <td>${row['设计液位厘米']}</td>
            <td>${row['期内液位均值']}</td>
            <td><span style="color: ${getPhColor(row['期内pH均值'])}; font-weight: 600;">${row['期内pH均值']}</span></td>
            <td>${row['期内盐花厚度均值']}</td>
            <td>${row['记录天数']}</td>
        `;
        tr.addEventListener('click', function(e) {
            const isMultiSelect = e.ctrlKey || e.metaKey;
            togglePondSelection(pondId, isMultiSelect);
        });
        tbody.appendChild(tr);
    });
}

function renderAdjacentTable(data) {
    const tbody = document.querySelector('#adjacentTable tbody');
    tbody.innerHTML = '';

    let filteredData = data;
    if (selectedPonds.length > 0) {
        filteredData = data.filter(row =>
            selectedPonds.includes(row['池号1']) || selectedPonds.includes(row['池号2'])
        );
    }

    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        const diffClass = row['pH差值'] > 0.3 ? 'color: #e74c3c;' : row['pH差值'] > 0.15 ? 'color: #f39c12;' : 'color: #27ae60;';
        const pond1Highlight = selectedPonds.includes(row['池号1']) ? 'background: rgba(240, 147, 251, 0.2);' : '';
        const pond2Highlight = selectedPonds.includes(row['池号2']) ? 'background: rgba(240, 147, 251, 0.2);' : '';
        tr.innerHTML = `
            <td>${row['组号']}</td>
            <td style="${pond1Highlight}">${row['池号1']}${selectedPonds.includes(row['池号1']) ? ' <span class="focus-badge">已选</span>' : ''}</td>
            <td style="${pond2Highlight}">${row['池号2']}${selectedPonds.includes(row['池号2']) ? ' <span class="focus-badge">已选</span>' : ''}</td>
            <td>${row['池1_pH均值']}</td>
            <td>${row['池2_pH均值']}</td>
            <td><strong style="${diffClass}">${row['pH差值']}</strong></td>
            <td>${row['记录天数']}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPhBarChart(data) {
    const groups = {};
    data.forEach(row => {
        const group = row['所在组'];
        if (!groups[group]) groups[group] = {};
        groups[group][row['池号']] = {
            value: row['期内pH均值'],
            level: row['期内液位均值'],
            designLevel: row['设计液位厘米']
        };
    });

    const allPonds = [];
    const pondToGroup = {};
    data.forEach(row => {
        if (!allPonds.includes(row['池号'])) {
            allPonds.push(row['池号']);
            pondToGroup[row['池号']] = row['所在组'];
        }
    });
    allPonds.sort();

    const series = [];
    const legendData = [];

    Object.keys(groups).sort().forEach(group => {
        legendData.push(group);
        const groupData = groups[group];

        const alignedData = allPonds.map(pond => {
            if (groupData[pond]) {
                const isSelected = selectedPonds.includes(pond);
                const baseColor = GROUP_COLORS[group] || '#666';
                const opacity = selectedPonds.length > 0 && !isSelected ? 0.3 : 1;
                return {
                    value: groupData[pond].value,
                    itemStyle: {
                        color: baseColor,
                        opacity: opacity
                    }
                };
            }
            return { value: '-' };
        });

        series.push({
            name: group,
            type: 'bar',
            data: alignedData,
            barGap: '10%',
            label: {
                show: true,
                position: 'top',
                formatter: function(params) {
                    return params.value === '-' ? '' : params.value;
                }
            }
        });
    });

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: function(params) {
                const validParams = params.filter(p => p.value !== '-');
                if (validParams.length === 0) return '';
                const p = validParams[0];
                const isSelected = selectedPonds.includes(p.name);
                return `<strong>${p.name}</strong>${isSelected ? ' <span style="color:#f5576c;">(已聚焦)</span>' : ''}<br/>pH均值: ${p.value}`;
            }
        },
        legend: {
            data: legendData,
            top: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: allPonds,
            axisLabel: {
                rotate: 45,
                formatter: function(value) {
                    if (selectedPonds.includes(value)) {
                        return '{selected|' + value + '}';
                    }
                    return value;
                },
                rich: {
                    selected: {
                        color: '#f5576c',
                        fontWeight: 'bold'
                    }
                }
            }
        },
        yAxis: {
            type: 'value',
            name: 'pH值',
            min: 4,
            max: 8
        },
        series: series
    };

    phBarChart.setOption(option);
}

function renderPhDiffScatterChart(data) {
    let filteredData = data;
    if (selectedPonds.length > 0) {
        filteredData = data.filter(row =>
            selectedPonds.includes(row['池号1']) || selectedPonds.includes(row['池号2'])
        );
    }

    const groups = {};
    filteredData.forEach(row => {
        const group = row['组号'];
        if (!groups[group]) groups[group] = [];
        const isRelated = selectedPonds.includes(row['池号1']) || selectedPonds.includes(row['池号2']);
        const opacity = selectedPonds.length > 0 && !isRelated ? 0.3 : 0.7;
        groups[group].push({
            name: `${row['池号1']}-${row['池号2']}`,
            value: [row['池1_pH均值'], row['池2_pH均值'], row['pH差值']],
            diff: row['pH差值'],
            opacity: opacity,
            pond1: row['池号1'],
            pond2: row['池号2']
        });
    });

    const series = [];
    const legendData = [];

    Object.keys(groups).forEach(group => {
        legendData.push(group);
        series.push({
            name: group,
            type: 'scatter',
            data: groups[group].map(item => ({
                value: item.value,
                symbolSize: Math.max(10, item.diff * 50),
                pond1: item.pond1,
                pond2: item.pond2,
                itemStyle: {
                    color: GROUP_COLORS[group] || '#666',
                    opacity: item.opacity
                }
            })),
            label: {
                show: true,
                formatter: function(params) {
                    return params.data.value[2].toFixed(2);
                },
                position: 'top',
                fontSize: 10
            }
        });
    });

    const option = {
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                const pond1 = params.data.pond1;
                const pond2 = params.data.pond2;
                const isRelated = selectedPonds.includes(pond1) || selectedPonds.includes(pond2);
                return `<strong>${params.seriesName}</strong>${isRelated && selectedPonds.length > 0 ? ' <span style="color:#f5576c;">(已聚焦)</span>' : ''}<br/>
                        池1 pH: ${params.value[0]}<br/>
                        池2 pH: ${params.value[1]}<br/>
                        <strong>pH差值: ${params.value[2]}</strong>`;
            }
        },
        legend: {
            data: legendData,
            top: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: '池1 pH均值',
            min: 4,
            max: 8
        },
        yAxis: {
            type: 'value',
            name: '池2 pH均值',
            min: 4,
            max: 8
        },
        series: series
    };

    phDiffScatterChart.setOption(option);
}

function renderGroupLayoutChart(data) {
    if (!data) return;

    const groups = Object.keys(data).sort();
    const maxPonds = Math.max(...groups.map(g => data[g].length));

    const series = [];
    const gridWidth = 80;
    const gridHeight = 60;
    const gapX = 20;
    const gapY = 30;
    const startX = 80;
    const startY = 60;

    const pondPositions = [];

    groups.forEach((group, groupIdx) => {
        const ponds = data[group];
        ponds.forEach((pond, pondIdx) => {
            const pondId = pond['池号'];
            const x = startX + pondIdx * (gridWidth + gapX);
            const y = startY + groupIdx * (gridHeight + gapY);
            const isSelected = selectedPonds.includes(pondId);

            pondPositions.push({
                pondId: pondId,
                x: x,
                y: y,
                width: gridWidth,
                height: gridHeight
            });

            series.push({
                type: 'custom',
                name: `pond_${pondId}`,
                renderItem: function(params, api) {
                    const strokeColor = isSelected ? '#f5576c' : '#fff';
                    const lineWidth = isSelected ? 4 : 2;
                    const shadowBlur = isSelected ? 20 : 10;
                    const shadowColor = isSelected ? 'rgba(245, 87, 108, 0.6)' : 'rgba(0,0,0,0.2)';
                    return {
                        type: 'rect',
                        shape: {
                            x: x,
                            y: y,
                            width: gridWidth,
                            height: gridHeight,
                            r: 8
                        },
                        style: {
                            fill: GROUP_COLORS[group] || '#666',
                            stroke: strokeColor,
                            lineWidth: lineWidth,
                            shadowBlur: shadowBlur,
                            shadowColor: shadowColor
                        }
                    };
                },
                data: [{ value: 0, pondId: pondId }]
            });

            series.push({
                type: 'custom',
                renderItem: function(params, api) {
                    return {
                        type: 'text',
                        style: {
                            text: pond['池号'],
                            x: x + gridWidth / 2,
                            y: y + gridHeight / 2 - 8,
                            fill: isSelected ? '#fff' : '#fff',
                            fontSize: isSelected ? 17 : 16,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            textVerticalAlign: 'middle'
                        }
                    };
                },
                data: [0]
            });

            series.push({
                type: 'custom',
                renderItem: function(params, api) {
                    return {
                        type: 'text',
                        style: {
                            text: `${pond['设计液位厘米']}cm${isSelected ? ' ✨' : ''}`,
                            x: x + gridWidth / 2,
                            y: y + gridHeight / 2 + 12,
                            fill: 'rgba(255,255,255,0.95)',
                            fontSize: 11,
                            fontWeight: isSelected ? 'bold' : 'normal',
                            textAlign: 'center',
                            textVerticalAlign: 'middle'
                        }
                    };
                },
                data: [0]
            });
        });

        series.push({
            type: 'custom',
            renderItem: function(params, api) {
                return {
                    type: 'text',
                    style: {
                        text: group,
                        x: 30,
                        y: startY + groupIdx * (gridHeight + gapY) + gridHeight / 2,
                        fill: '#333',
                        fontSize: 14,
                        fontWeight: 'bold',
                        textAlign: 'right',
                        textVerticalAlign: 'middle'
                    }
                };
            },
            data: [0]
        });
    });

    const option = {
        tooltip: {
            show: true,
            trigger: 'item',
            formatter: function(params) {
                if (params.seriesName && params.seriesName.startsWith('pond_')) {
                    const pondId = params.seriesName.replace('pond_', '');
                    const isSelected = selectedPonds.includes(pondId);
                    return `<strong>${pondId}</strong>${isSelected ? ' <span style="color:#f5576c;">(已聚焦)</span>' : ''}<br/>点击选中/取消<br/>Ctrl+点击多选`;
                }
                return '';
            }
        },
        grid: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        },
        xAxis: {
            show: false,
            min: 0,
            max: startX + maxPonds * (gridWidth + gapX) + 50
        },
        yAxis: {
            show: false,
            min: 0,
            max: startY + groups.length * (gridHeight + gapY) + 50
        },
        series: series
    };

    groupLayoutChart.setOption(option);

    groupLayoutChart.off('click');
    groupLayoutChart.on('click', function(params) {
        if (params.seriesName && params.seriesName.startsWith('pond_')) {
            const pondId = params.seriesName.replace('pond_', '');
            const pondData = cachedData.periodAverages.find(p => p['池号'] === pondId);
            if (pondData) {
                togglePondSelection(pondId, false);
            } else {
                showToast(`池号 ${pondId} 不在当前查询结果中`, 'info');
            }
        }
    });
}

function renderTrendChart(data) {
    if (data.length === 0) {
        trendChart.setOption({ title: { text: '暂无数据', left: 'center', top: 'center' } });
        return;
    }

    const dates = [...new Set(data.map(d => d['记录日期']))].sort();
    let ponds = [...new Set(data.map(d => d['池号']))].sort();

    if (selectedPonds.length > 0) {
        ponds = ponds.filter(p => selectedPonds.includes(p));
    }

    if (ponds.length === 0) {
        const title = selectedPonds.length > 0
            ? `已聚焦池号 ${selectedPonds.join('、')} 无趋势数据`
            : '暂无数据';
        trendChart.setOption({ title: { text: title, left: 'center', top: 'center' } });
        return;
    }

    const phSeries = [];
    const levelSeries = [];

    ponds.forEach(pond => {
        const pondData = data.filter(d => d['池号'] === pond).sort((a, b) => a['记录日期'].localeCompare(b['记录日期']));
        const group = pondData[0]?.['所在组'];
        const color = GROUP_COLORS[group] || '#666';
        const isSelected = selectedPonds.includes(pond);
        const opacity = selectedPonds.length > 0 && !isSelected ? 0.3 : 1;

        phSeries.push({
            name: `${pond} pH`,
            type: 'line',
            yAxisIndex: 0,
            data: dates.map(date => {
                const d = pondData.find(p => p['记录日期'] === date);
                return d ? d['pH'] : null;
            }),
            smooth: true,
            lineStyle: { color: color, width: isSelected ? 3 : 2, opacity: opacity },
            itemStyle: { color: color, opacity: opacity },
            symbol: 'circle',
            symbolSize: isSelected ? 8 : 6
        });

        levelSeries.push({
            name: `${pond} 液位`,
            type: 'line',
            yAxisIndex: 1,
            data: dates.map(date => {
                const d = pondData.find(p => p['记录日期'] === date);
                return d ? d['实测液位厘米'] : null;
            }),
            smooth: true,
            lineStyle: { color: color, width: isSelected ? 3 : 2, type: 'dashed', opacity: opacity },
            itemStyle: { color: color, opacity: opacity },
            symbol: 'diamond',
            symbolSize: isSelected ? 8 : 6
        });
    });

    const legendData = [...ponds.map(p => `${p} pH`), ...ponds.map(p => `${p} 液位`)];

    const option = {
        title: {
            text: selectedPonds.length > 0 ? `已聚焦: ${selectedPonds.join('、')}` : '',
            right: 10,
            top: 0,
            textStyle: {
                fontSize: 12,
                color: '#f5576c'
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let result = `<strong>${params[0].axisValue}</strong><br/>`;
                params.forEach(p => {
                    const isFocused = selectedPonds.some(sp => p.seriesName.startsWith(sp));
                    result += `${p.marker}${p.seriesName}: ${p.value !== null ? p.value : '-'}${isFocused && selectedPonds.length > 0 ? ' <span style="color:#f5576c;">(已聚焦)</span>' : ''}<br/>`;
                });
                return result;
            }
        },
        legend: {
            data: legendData,
            top: 0,
            type: 'scroll',
            textStyle: { fontSize: 10 },
            left: 0,
            right: 150
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '20%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { rotate: 45, fontSize: 10 }
        },
        yAxis: [
            {
                type: 'value',
                name: 'pH值',
                min: 4,
                max: 8,
                position: 'left'
            },
            {
                type: 'value',
                name: '液位(cm)',
                min: 80,
                max: 220,
                position: 'right'
            }
        ],
        series: [...phSeries, ...levelSeries]
    };

    trendChart.setOption(option, true);
}

function getPhColor(ph) {
    if (ph < 5.5) return '#e74c3c';
    if (ph < 6.0) return '#f39c12';
    if (ph < 6.5) return '#27ae60';
    return '#3498db';
}

function openImportModal() {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    document.getElementById('importResult').className = 'import-result';
    document.getElementById('importResult').textContent = '';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'csv') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('csvTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('manualTab').classList.add('active');
    }
}

async function importCsv() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        showImportResult('请选择CSV文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/api/import-csv`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            showImportResult(data.message, 'success');
            showToast(data.message, 'success');
            loadData();
            fileInput.value = '';
        } else {
            let errorMsg = data.message;
            if (data.errors && data.errors.length > 0) {
                errorMsg = data.errors.join('<br/>');
            }
            showImportResult(errorMsg, 'error');
        }
    } catch (error) {
        showImportResult('导入失败: ' + error.message, 'error');
    }
}

function validateManualRecord(record) {
    if (!record['池号']) {
        return '请选择池号';
    }
    if (!record['记录日期']) {
        return '请选择记录日期';
    }
    if (isNaN(record['pH']) || record['pH'] < 0 || record['pH'] > 14) {
        return 'pH值必须在0-14之间';
    }
    if (isNaN(record['实测液位厘米']) || record['实测液位厘米'] <= 0 || record['实测液位厘米'] > 300) {
        return '实测液位必须在0-300厘米之间';
    }
    if (isNaN(record['表层盐花厚度毫米']) || record['表层盐花厚度毫米'] < 0 || record['表层盐花厚度毫米'] > 100) {
        return '表层盐花厚度必须在0-100毫米之间';
    }
    return null;
}

async function addManualRecord() {
    const record = {
        '池号': document.getElementById('manualPond').value,
        '记录日期': document.getElementById('manualDate').value,
        '实测液位厘米': parseFloat(document.getElementById('manualLevel').value),
        'pH': parseFloat(document.getElementById('manualPh').value),
        '表层盐花厚度毫米': parseFloat(document.getElementById('manualSalt').value)
    };

    const validationError = validateManualRecord(record);
    if (validationError) {
        showImportResult(validationError, 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [record] })
        });
        const data = await res.json();

        if (data.success) {
            showImportResult(data.message, 'success');
            showToast(data.message, 'success');
            loadData();

            document.getElementById('manualLevel').value = '';
            document.getElementById('manualPh').value = '';
            document.getElementById('manualSalt').value = '';
        } else {
            let errorMsg = data.message;
            if (data.errors && data.errors.length > 0) {
                errorMsg = data.errors.join('<br/>');
            }
            showImportResult(errorMsg, 'error');
        }
    } catch (error) {
        showImportResult('添加失败: ' + error.message, 'error');
    }
}

function showImportResult(message, type) {
    const resultEl = document.getElementById('importResult');
    if (message.includes('<br/>')) {
        resultEl.innerHTML = message;
    } else {
        resultEl.textContent = message;
    }
    resultEl.className = `import-result ${type}`;
}

function showExportMenu() {
    const menu = document.getElementById('exportMenu');
    const btn = event.target.closest('.btn-info');
    const rect = btn.getBoundingClientRect();

    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = rect.left + 'px';
    menu.classList.toggle('active');
}

async function exportData(type) {
    if (currentFilters.startDate && currentFilters.endDate && currentFilters.startDate > currentFilters.endDate) {
        showToast('起始日期不能大于结束日期', 'error');
        return;
    }

    const params = new URLSearchParams({
        ...currentFilters,
        type: type
    });
    document.getElementById('exportMenu').classList.remove('active');
    showToast('导出中...', 'info');

    try {
        const res = await fetch(`${API_BASE}/api/export?${params}`);
        const contentType = res.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            showToast(data.message || '导出失败', 'error');
            return;
        }

        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition');
        let filename = `export_${Date.now()}.csv`;
        if (disposition) {
            const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match && match[1]) {
                filename = match[1].replace(/['"]/g, '');
            }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('导出成功', 'success');
    } catch (error) {
        showToast('导出失败: ' + error.message, 'error');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
