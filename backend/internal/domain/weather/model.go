package weather

type weatherResponse struct {
	City  string `json:"city"`
	Temp  int    `json:"temp"`
	Icon  string `json:"icon"`
	Label string `json:"label"`
}

type weatherCitiesResponse struct {
	Cities []weatherResponse `json:"cities"`
}

// cities 6 个代表性城市坐标
var cities = []struct {
	Name string
	Lat  float64
	Lon  float64
}{
	{"北京", 39.90, 116.40},
	{"上海", 31.23, 121.47},
	{"广州", 23.13, 113.26},
	{"成都", 30.57, 104.06},
	{"哈尔滨", 45.80, 126.53},
	{"乌鲁木齐", 43.79, 87.58},
}

// wmoMap Open-Meteo WMO 天气码 → 图标 + 中文标签
var wmoMap = map[int][2]string{
	0: {"☀️", "晴天"}, 1: {"🌤️", "少云"}, 2: {"⛅", "多云"}, 3: {"☁️", "阴"},
	45: {"🌫️", "雾"}, 48: {"🌫️", "雾凇"},
	51: {"🌧️", "小雨"}, 53: {"🌧️", "毛毛雨"}, 55: {"🌧️", "毛毛雨"},
	61: {"🌧️", "小雨"}, 63: {"🌧️", "中雨"}, 65: {"🌧️", "大雨"},
	71: {"❄️", "小雪"}, 73: {"❄️", "中雪"}, 75: {"❄️", "大雪"}, 77: {"❄️", "雪粒"},
	80: {"🌦️", "阵雨"}, 81: {"🌦️", "阵雨"}, 82: {"🌦️", "强阵雨"},
	85: {"❄️", "阵雪"}, 86: {"❄️", "阵雪"},
	95: {"⛈️", "雷暴"}, 96: {"⛈️", "冰雹雷暴"}, 99: {"⛈️", "强雷暴"},
}
