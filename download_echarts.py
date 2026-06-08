import urllib.request
import os

os.makedirs('static/js', exist_ok=True)

url = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js'
output = 'static/js/echarts.min.js'

print(f'正在下载 ECharts...')
urllib.request.urlretrieve(url, output)
print(f'下载完成，保存到: {output}')
print(f'文件大小: {os.path.getsize(output)} bytes')
