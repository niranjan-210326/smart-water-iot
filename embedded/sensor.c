#include "sensor.h"

#include <stdlib.h>
#include <time.h>

#define WATER_LEVEL_MIN 0
#define WATER_LEVEL_MAX 100
#define SENSOR_DRIFT_MAX 5

int get_water_level(void) {
    static int seeded = 0;
    static int current_level = 50;
    int delta = 0;

    if (!seeded) {
        srand((unsigned int)time(NULL));
        seeded = 1;
    }

    delta = (rand() % ((SENSOR_DRIFT_MAX * 2) + 1)) - SENSOR_DRIFT_MAX;
    current_level += delta;

    if (current_level < WATER_LEVEL_MIN) {
        current_level = WATER_LEVEL_MIN;
    } else if (current_level > WATER_LEVEL_MAX) {
        current_level = WATER_LEVEL_MAX;
    }

    return current_level;
}
