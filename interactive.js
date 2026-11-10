(() => {
  const mapSvg = d3.select('#neighborhood-map');
  const barsSvg = d3.select('#ranked-bars');
  const durationSvg = d3.select('#duration-bars');
  const mapTip = d3.select('#map-tooltip');
  const barTip = d3.select('#bar-tooltip');
  const mapRoot = document.querySelector('#map-figure');
  const barRoot = document.querySelector('#bar-figure');
  const countSelect = document.querySelector('#bar-count');

  const friendlyName = (d) => d.display_name || d.official_name;
  const hours = (value) => `${d3.format('.1f')(value)} hours`;
  const durationData = [
    { label: 'Under 1 hour', count: 1195, percent: 24.7 },
    { label: '1–3 hours', count: 1414, percent: 29.2 },
    { label: '3–12 hours', count: 528, percent: 10.9 },
    { label: '12–24 hours', count: 413, percent: 8.5 },
    { label: '1–5 days', count: 796, percent: 16.4 },
    { label: '5–30 days', count: 355, percent: 7.3, slow: true },
    { label: 'More than 30 days', count: 141, percent: 2.9, slow: true }
  ];

  function positionTip(selection, root, event) {
    const rect = root.getBoundingClientRect();
    const x = Math.min(event.clientX - rect.left + 14, rect.width - 285);
    const y = Math.max(8, event.clientY - rect.top - 30);
    selection.style('left', `${Math.max(8, x)}px`).style('top', `${y}px`);
  }

  function mapTipHtml(p) {
    const official = p.display_name !== p.official_name
      ? `<span class="tip-official">City area: ${p.official_name}</span>` : '';
    if (!p.eligible) {
      return `<span class="tip-name">${friendlyName(p)}</span>Fewer than 20 matched requests${official}`;
    }
    return `<span class="tip-name">${friendlyName(p)}</span>` +
      `Median closure: ${hours(p.median_hours)}<br>` +
      `${p.complaints} complaints · rank ${p.rank} of 83${official}`;
  }

  function barTipHtml(d) {
    const official = d.display_name !== d.official_name
      ? `<span class="tip-official">City area: ${d.official_name}</span>` : '';
    return `<span class="tip-name">${friendlyName(d)}</span>` +
      `Median closure: ${hours(d.median_hours)}<br>` +
      `${d.complaints} complaints · 90% closed within ${hours(d.p90_hours)}${official}`;
  }

  Promise.all([
    fetch('assets/neighborhoods.geojson').then(r => r.json()),
    fetch('assets/neighborhood-summary.json').then(r => r.json())
  ]).then(([geo, summary]) => {
    drawMap(geo);
    drawBars(summary, Number(countSelect.value));
    drawDuration();

    countSelect.addEventListener('change', () => drawBars(summary, Number(countSelect.value)));
    new ResizeObserver(() => {
      drawMap(geo);
      drawBars(summary, Number(countSelect.value));
      drawDuration();
    }).observe(document.querySelector('#map-figure'));
  }).catch(() => {
    document.querySelector('#map-figure .map-stage').innerHTML = '<p class="interaction-note">The interactive map could not load.</p>';
  });

  function drawMap(geo) {
    const node = mapSvg.node();
    const width = Math.max(320, node.clientWidth || 900);
    const height = window.innerWidth < 680 ? 440 : 520;
    mapSvg.attr('viewBox', `0 0 ${width} ${height}`);
    mapSvg.selectAll('*').remove();

    mapSvg.append('title').attr('id', 'map-title').text('Administrative closure times by neighborhood');
    mapSvg.append('desc').attr('id', 'map-description').text('An interactive map of New York City. Darker areas had longer median administrative closure times. Scroll to zoom and drag to pan.');

    const projection = d3.geoMercator().fitExtent([[22, 18], [width - 22, height - 22]], geo);
    const path = d3.geoPath(projection);
    const eligibleValues = geo.features.filter(d => d.properties.eligible).map(d => d.properties.median_hours);
    const color = d3.scaleSequential()
      .domain(d3.extent(eligibleValues))
      .interpolator(d3.interpolateRgbBasis(['#dbe8f2', '#7fa6c8', '#244f7a']));

    const layer = mapSvg.append('g');
    layer.selectAll('path')
      .data(geo.features)
      .join('path')
      .attr('class', 'neighborhood-area')
      .attr('d', path)
      .attr('fill', d => d.properties.eligible ? color(d.properties.median_hours) : '#efefec')
      .attr('tabindex', 0)
      .attr('aria-label', d => d.properties.eligible
        ? `${friendlyName(d.properties)}: median ${hours(d.properties.median_hours)}, ${d.properties.complaints} complaints`
        : `${friendlyName(d.properties)}: fewer than 20 matched requests`)
      .on('pointerenter pointermove', (event, d) => {
        mapTip.html(mapTipHtml(d.properties)).classed('is-visible', true);
        positionTip(mapTip, mapRoot, event);
      })
      .on('pointerleave', () => mapTip.classed('is-visible', false))
      .on('focus', function(event, d) {
        const r = this.getBoundingClientRect();
        mapTip.html(mapTipHtml(d.properties)).classed('is-visible', true);
        positionTip(mapTip, mapRoot, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      })
      .on('blur', () => mapTip.classed('is-visible', false));

    const zoom = d3.zoom()
      .scaleExtent([1, 9])
      .translateExtent([[-width, -height], [width * 2, height * 2]])
      .on('zoom', (event) => layer.attr('transform', event.transform));
    mapSvg.call(zoom).on('dblclick.zoom', null);

    document.querySelectorAll('[data-map-action]').forEach(button => {
      button.onclick = () => {
        const action = button.dataset.mapAction;
        if (action === 'reset') mapSvg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        else mapSvg.transition().duration(200).call(zoom.scaleBy, action === 'in' ? 1.5 : 1 / 1.5);
      };
    });
  }

  function drawBars(summary, count) {
    const data = summary.slice().sort((a, b) => d3.descending(a.median_hours, b.median_hours)).slice(0, count);
    const node = barsSvg.node();
    const width = Math.max(320, node.clientWidth || 900);
    const rowHeight = count <= 15 ? 30 : 27;
    const margin = { top: 8, right: 54, bottom: 44, left: width < 620 ? 150 : 225 };
    const height = margin.top + margin.bottom + data.length * rowHeight;
    barsSvg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);
    barsSvg.selectAll('*').remove();

    barsSvg.append('title').attr('id', 'bars-title').text('Neighborhoods ranked by median administrative closure time');
    barsSvg.append('desc').attr('id', 'bars-description').text('A horizontal bar chart. Brownsville has the longest median closure time among eligible areas. Use the menu to show 15, 30, or all 83 areas.');

    const x = d3.scaleLinear()
      .domain([0, d3.max(summary, d => d.median_hours) * 1.08])
      .nice()
      .range([margin.left, width - margin.right]);
    const y = d3.scaleBand()
      .domain(data.map(d => d.official_name))
      .range([margin.top, height - margin.bottom])
      .padding(0.24);

    const ticks = width < 600 ? 4 : 7;
    barsSvg.append('g')
      .attr('class', 'bar-grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(ticks).tickSize(-(height - margin.top - margin.bottom)).tickFormat(''))
      .call(g => g.select('.domain').remove());

    barsSvg.selectAll('.bar-label')
      .data(data)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', margin.left - 10)
      .attr('y', d => y(d.official_name) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'end')
      .text(d => friendlyName(d));

    barsSvg.selectAll('.bar-mark')
      .data(data)
      .join('rect')
      .attr('class', 'bar-mark')
      .attr('x', x(0))
      .attr('y', d => y(d.official_name))
      .attr('width', d => x(d.median_hours) - x(0))
      .attr('height', y.bandwidth())
      .attr('tabindex', 0)
      .attr('aria-label', d => `${friendlyName(d)}: median ${hours(d.median_hours)}, ${d.complaints} complaints`)
      .on('pointerenter pointermove', (event, d) => {
        barTip.html(barTipHtml(d)).classed('is-visible', true);
        positionTip(barTip, barRoot, event);
      })
      .on('pointerleave', () => barTip.classed('is-visible', false))
      .on('focus', function(event, d) {
        const r = this.getBoundingClientRect();
        barTip.html(barTipHtml(d)).classed('is-visible', true);
        positionTip(barTip, barRoot, { clientX: r.right, clientY: r.top + r.height / 2 });
      })
      .on('blur', () => barTip.classed('is-visible', false));

    barsSvg.selectAll('.bar-value')
      .data(data)
      .join('text')
      .attr('class', 'bar-value')
      .attr('x', d => x(d.median_hours) + 6)
      .attr('y', d => y(d.official_name) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .text(d => d3.format('.1f')(d.median_hours));

    barsSvg.append('g')
      .attr('class', 'bar-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(ticks).tickSizeOuter(0));

    barsSvg.append('text')
      .attr('class', 'axis-title')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 7)
      .attr('text-anchor', 'middle')
      .text('Median administrative closure time (hours)');

    document.querySelector('#bar-scroll').scrollTop = 0;
  }

  function drawDuration() {
    const node = durationSvg.node();
    const width = Math.max(320, node.clientWidth || 900);
    const margin = { top: 6, right: 64, bottom: 46, left: width < 620 ? 135 : 190 };
    const rowHeight = 36;
    const height = margin.top + margin.bottom + durationData.length * rowHeight;
    durationSvg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);
    durationSvg.selectAll('*').remove();

    durationSvg.append('title').attr('id', 'duration-title').text('Share of requests by administrative closure time');
    durationSvg.append('desc').attr('id', 'duration-description').text('Horizontal bars show that 53.9 percent of cases closed within three hours, while 10.2 percent took more than five days.');

    const x = d3.scaleLinear().domain([0, 32]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand()
      .domain(durationData.map(d => d.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);

    durationSvg.append('g')
      .attr('class', 'bar-grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width < 600 ? 4 : 6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(''))
      .call(g => g.select('.domain').remove());

    durationSvg.selectAll('.duration-label')
      .data(durationData)
      .join('text')
      .attr('class', 'duration-label')
      .attr('x', margin.left - 10)
      .attr('y', d => y(d.label) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'end')
      .text(d => d.label);

    durationSvg.selectAll('.duration-mark')
      .data(durationData)
      .join('rect')
      .attr('class', d => `duration-mark${d.slow ? ' slow' : ''}`)
      .attr('x', x(0))
      .attr('y', d => y(d.label))
      .attr('width', d => x(d.percent) - x(0))
      .attr('height', y.bandwidth());

    durationSvg.selectAll('.duration-value')
      .data(durationData)
      .join('text')
      .attr('class', 'duration-value')
      .attr('x', d => x(d.percent) + 7)
      .attr('y', d => y(d.label) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .text(d => `${d.percent.toFixed(1)}%`);

    durationSvg.append('g')
      .attr('class', 'bar-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(width < 600 ? 4 : 6).tickSizeOuter(0).tickFormat(d => `${d}%`));

    durationSvg.append('text')
      .attr('class', 'axis-title')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 7)
      .attr('text-anchor', 'middle')
      .text('Share of all pedestrian-signal requests');
  }
})();
