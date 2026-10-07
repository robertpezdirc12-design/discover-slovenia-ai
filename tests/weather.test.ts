/**
 * WEATHER — čista logika vremenskega modula (FAZA 3, Task 51-a).
 *
 * Zaklene kanone izvirnika (go-weather.ts / v1.190.0):
 * - validacija ?lat&lng (lat ±90, lng ±180; vse drugo → null → strežnik 400),
 * - WMO weather_code → POŠTENE oznake SL+EN (nerazpoznana koda → "vreme",
 *   brez lažne natančnosti),
 * - ZASEBNOST predpomnilnika: ključ zaokrožen na 2 decimalki (~1,1 km mreža —
 *   iz ključa ni mogoče rekonstruirati točne lege),
 * - tipovska straža odgovora (klient ne zaupa slepo obliki z žice).
 */

import { describe, expect, test } from "bun:test";

import {
  cacheKeyFor,
  isWeatherResponse,
  parseWeatherParams,
  weatherLabel,
  type WeatherResponse,
} from "../src/lib/weather";

describe("weather: parseWeatherParams (validacija ?lat&lng)", () => {
  test("veljavni koordinati (Ljubljana) — z in brez vodilnega '?'", () => {
    expect(parseWeatherParams("lat=46.05&lng=14.51")).toEqual({ lat: 46.05, lng: 14.51 });
    expect(parseWeatherParams("?lat=46.05&lng=14.51")).toEqual({ lat: 46.05, lng: 14.51 });
  });

  test("veljavni negativni in mejni koordinati (lat ±90, lng ±180)", () => {
    expect(parseWeatherParams("lat=-45.5&lng=-73.0")).toEqual({ lat: -45.5, lng: -73 });
    expect(parseWeatherParams("lat=90&lng=180")).toEqual({ lat: 90, lng: 180 });
    expect(parseWeatherParams("lat=-90&lng=-180")).toEqual({ lat: -90, lng: -180 });
  });

  test("manjkajoči parametri → null", () => {
    expect(parseWeatherParams("lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=46.05")).toBeNull();
    expect(parseWeatherParams("")).toBeNull();
  });

  test("izven obsega → null (lat > 90 / < -90, lng > 180 / < -180)", () => {
    expect(parseWeatherParams("lat=90.1&lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=-90.5&lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=46.05&lng=180.5")).toBeNull();
    expect(parseWeatherParams("lat=46.05&lng=-181")).toBeNull();
    expect(parseWeatherParams("lat=999&lng=14.51")).toBeNull();
  });

  test("neštevilske vrednosti → null (vključno vejica namesto pike)", () => {
    expect(parseWeatherParams("lat=abc&lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=46.05&lng=xyz")).toBeNull();
    expect(parseWeatherParams("lat=46,05&lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=NaN&lng=14.51")).toBeNull();
  });

  test("prazni vrednosti → null (prazen niz NI število 0)", () => {
    expect(parseWeatherParams("lat=&lng=14.51")).toBeNull();
    expect(parseWeatherParams("lat=46.05&lng=")).toBeNull();
    expect(parseWeatherParams("lat=%20&lng=14.51")).toBeNull();
  });
});

describe("weather: weatherLabel (WMO koda → oznaka SL + EN)", () => {
  test("predstavniške kode — slovenščina", () => {
    expect(weatherLabel(0, "sl")).toBe("jasno");
    expect(weatherLabel(2, "sl")).toBe("delno oblačno");
    expect(weatherLabel(45, "sl")).toBe("megla");
    expect(weatherLabel(61, "sl")).toBe("dež");
    expect(weatherLabel(71, "sl")).toBe("sneg");
    expect(weatherLabel(95, "sl")).toBe("nevihta");
  });

  test("predstavniške kode — angleščina", () => {
    expect(weatherLabel(0, "en")).toBe("clear");
    expect(weatherLabel(2, "en")).toBe("partly cloudy");
    expect(weatherLabel(45, "en")).toBe("fog");
    expect(weatherLabel(61, "en")).toBe("rain");
    expect(weatherLabel(71, "en")).toBe("snow");
    expect(weatherLabel(95, "en")).toBe("thunderstorm");
  });

  test("ostale kode nabora (oblačnost, rahle padavine, plohe, toča)", () => {
    expect(weatherLabel(1, "sl")).toBe("pretežno jasno");
    expect(weatherLabel(1, "en")).toBe("mainly clear");
    expect(weatherLabel(3, "sl")).toBe("oblačno");
    expect(weatherLabel(48, "en")).toBe("fog");
    expect(weatherLabel(53, "sl")).toBe("rosenje");
    expect(weatherLabel(80, "sl")).toBe("plohe");
    expect(weatherLabel(80, "en")).toBe("rain showers");
    expect(weatherLabel(86, "en")).toBe("snow");
    expect(weatherLabel(99, "sl")).toBe("nevihta");
  });

  test("ISKRENOST: nerazpoznana koda → splošna oznaka brez lažne natančnosti", () => {
    expect(weatherLabel(42, "sl")).toBe("vreme");
    expect(weatherLabel(42, "en")).toBe("weather");
    expect(weatherLabel(-7, "sl")).toBe("vreme");
    expect(weatherLabel(2.5, "en")).toBe("weather");
  });
});

describe("weather: cacheKeyFor (zasebnost — zaokroževanje na 2 decimalki)", () => {
  test("zaokroži na 2 decimalki (46.0564 → \"46.06\")", () => {
    expect(cacheKeyFor(46.0564, 14.5136)).toBe("46.06,14.51");
    expect(cacheKeyFor(46.05, 14.51)).toBe("46.05,14.51");
  });

  test("negativne vrednosti in normalizacija −0 (determinističen ključ)", () => {
    expect(cacheKeyFor(-46.056, -14.514)).toBe("-46.06,-14.51");
    expect(cacheKeyFor(-0.001, -0.001)).toBe("0.00,0.00");
    expect(cacheKeyFor(0, 0)).toBe("0.00,0.00");
  });

  test("ZASEBNOST: bližnji točki (~1,1 km) padeta v isti ključ", () => {
    // Iz predpomnilnika ni mogoče rekonstruirati točne lege izpraševalca.
    expect(cacheKeyFor(46.05123, 14.51234)).toBe(cacheKeyFor(46.05444, 14.509));
  });
});

describe("weather: isWeatherResponse (tipovska straža odgovora)", () => {
  const sample: WeatherResponse = {
    ok: true,
    source: "open-meteo",
    fetchedAt: "2026-10-07T12:00:00.000Z",
    current: {
      time: "2026-10-07T12:00",
      temperatureC: 15.1,
      apparentC: 14.0,
      weatherCode: 3,
      windKmh: 10.2,
      precipitationMm: 0.0,
    },
  };

  test("kanonska oblika → true", () => {
    expect(isWeatherResponse(sample)).toBe(true);
  });

  test("popačena oblika → false (fail-closed, ne zaupa se žici)", () => {
    expect(isWeatherResponse(null)).toBe(false);
    expect(isWeatherResponse("ok")).toBe(false);
    expect(isWeatherResponse({ ...sample, ok: false })).toBe(false);
    expect(isWeatherResponse({ ...sample, source: "fantazija" })).toBe(false);
    expect(isWeatherResponse({ ...sample, fetchedAt: 123 })).toBe(false);
    expect(isWeatherResponse({ ...sample, current: null })).toBe(false);
    expect(isWeatherResponse({ ...sample, current: { ...sample.current, windKmh: "hitro" } })).toBe(
      false
    );
    expect(
      isWeatherResponse({
        ok: true,
        source: "open-meteo",
        fetchedAt: "2026-10-07T12:00:00.000Z",
        current: { time: "2026-10-07T12:00", temperatureC: 15.1 },
      })
    ).toBe(false);
  });
});
