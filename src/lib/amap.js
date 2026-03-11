// 高德地图 Web API 工具函数
// 文档：https://lbs.amap.com/api/javascript-api/summary

let AMap = null
let geolocation = null
let placeSearch = null
let isLoaded = false

/**
 * 初始化高德地图 JS SDK
 * 需要调用此函数后才能使用其他功能
 */
export async function initAmap() {
  if (isLoaded) return Promise.resolve()

  return new Promise((resolve, reject) => {
    if (window.AMap) {
      AMap = window.AMap
      isLoaded = true
      resolve()
      return
    }

    // 动态加载高德地图 JS SDK
    const script = document.createElement('script')
    script.type = 'text/javascript'
    const amapKey = import.meta.env.VITE_AMAP_KEY || ""
    if (!amapKey) {
      console.error('❌ 高德地图 API Key 缺失：请在 .env 文件中设置 VITE_AMAP_KEY')
      reject(new Error('高德地图 API Key 未配置'))
      return
    }
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&plugin=AMap.Geolocation,AMap.PlaceSearch`

    script.onload = () => {
      AMap = window.AMap
      isLoaded = true
      resolve()
    }

    script.onerror = () => {
      reject(new Error('高德地图 SDK 加载失败'))
    }

    document.head.appendChild(script)
  })
}

/**
 * 获取当前位置
 * @returns {Promise<{longitude: number, latitude: number, city: string}>}
 */
export async function getCurrentLocation() {
  if (!isLoaded) {
    await initAmap()
  }

  return new Promise((resolve, reject) => {
    AMap.plugin('AMap.Geolocation', () => {
      geolocation = new AMap.Geolocation({
        enableHighAccuracy: true, // 是否使用高精度定位
        timeout: 10000, // 超时时间
        needAddress: true, // 是否需要地址信息
        extensions: 'all' // 返回完整信息
      })

      geolocation.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          resolve({
            longitude: result.position.lng,
            latitude: result.position.lat,
            city: result.addressComponent?.city || result.addressComponent?.province || '',
            district: result.addressComponent?.district || '',
            formattedAddress: result.formattedAddress
          })
        } else {
          reject(new Error(result?.message || '定位失败'))
        }
      })
    })
  })
}

/**
 * 搜索附近的咖啡馆
 * @param {Object} location - {longitude, latitude} 中心点坐标
 * @param {string} keyword - 搜索关键词，默认"咖啡"
 * @param {number} radius - 搜索半径（米），默认 2000
 * @returns {Promise<Array>} 咖啡馆列表
 */
export async function searchNearbyCafes(location, keyword = '咖啡', radius = 2000) {
  if (!isLoaded) {
    await initAmap()
  }

  return new Promise((resolve, reject) => {
    AMap.plugin('AMap.PlaceSearch', () => {
      placeSearch = new AMap.PlaceSearch({
        type: '餐饮服务', // 兴趣点类别
        pageSize: 20, // 每页显示结果数
        pageIndex: 1, // 页码
        extensions: 'all' // 返回完整信息
      })

      placeSearch.searchNearBy(keyword, [location.longitude, location.latitude], radius, (status, result) => {
        if (status === 'complete' && result.poiList?.pois) {
          // 标准化返回数据
          const cafes = result.poiList.pois.map(poi => ({
            id: poi.id,
            name: poi.name,
            address: poi.address || '',
            distance: poi.distance ? parseInt(poi.distance) : null,
            location: {
              longitude: poi.location?.lng,
              latitude: poi.location?.lat
            },
            tel: poi.tel || '',
            rating: poi.rating || null
          }))
          resolve(cafes)
        } else {
          reject(new Error('搜索失败，请检查位置权限'))
        }
      })
    })
  })
}

/**
 * 计算两个坐标点之间的距离（米）
 */
export function calculateDistance(lng1, lat1, lng2, lat2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * 格式化距离显示
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}
