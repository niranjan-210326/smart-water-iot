#include "sensor.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#if !SIMULATION_MODE
#include <gpiod.h>
#endif

#define WATER_LEVEL_MIN 0
#define WATER_LEVEL_MAX 100
#define WATER_LEVEL_DEFAULT 50
#define SENSOR_DRIFT_MAX 5
#define GPIO_CHIP_NAME "gpiochip0"
#define SPEED_OF_SOUND_CM_PER_S 34300.0
#define TRIGGER_PULSE_US 10
#define ECHO_POLL_US 50

static int last_known_level = WATER_LEVEL_DEFAULT;
static int sensor_ready = 0;

#if !SIMULATION_MODE
static struct gpiod_chip *chip = NULL;
static struct gpiod_line *trig_line = NULL;
static struct gpiod_line *echo_line = NULL;
#endif

static long elapsed_us(const struct timespec *start, const struct timespec *end) {
    long seconds = end->tv_sec - start->tv_sec;
    long nanos = end->tv_nsec - start->tv_nsec;
    return (seconds * 1000000L) + (nanos / 1000L);
}

static int clamp_level(int level) {
    if (level < WATER_LEVEL_MIN) {
        return WATER_LEVEL_MIN;
    }
    if (level > WATER_LEVEL_MAX) {
        return WATER_LEVEL_MAX;
    }
    return level;
}

void sensor_init(void) {
#if SIMULATION_MODE
    srand((unsigned int)time(NULL));
    sensor_ready = 1;
#else
    chip = gpiod_chip_open_by_name(GPIO_CHIP_NAME);
    if (chip == NULL) {
        fprintf(stderr, "[Sensor] Failed to open %s: %s\n", GPIO_CHIP_NAME, strerror(errno));
        sensor_ready = 0;
        return;
    }

    trig_line = gpiod_chip_get_line(chip, TRIG_PIN);
    echo_line = gpiod_chip_get_line(chip, ECHO_PIN);
    if (trig_line == NULL || echo_line == NULL) {
        fprintf(stderr, "[Sensor] Failed to get TRIG/ECHO GPIO lines: %s\n", strerror(errno));
        sensor_cleanup();
        return;
    }

    if (gpiod_line_request_output(trig_line, "water_sensor_trig", 0) < 0) {
        fprintf(stderr, "[Sensor] Failed to request TRIG as output: %s\n", strerror(errno));
        sensor_cleanup();
        return;
    }

    if (gpiod_line_request_input(echo_line, "water_sensor_echo") < 0) {
        fprintf(stderr, "[Sensor] Failed to request ECHO as input: %s\n", strerror(errno));
        sensor_cleanup();
        return;
    }

    sensor_ready = 1;
#endif
}

void sensor_cleanup(void) {
#if SIMULATION_MODE
    sensor_ready = 0;
#else
    if (trig_line != NULL) {
        gpiod_line_release(trig_line);
        trig_line = NULL;
    }
    if (echo_line != NULL) {
        gpiod_line_release(echo_line);
        echo_line = NULL;
    }
    if (chip != NULL) {
        gpiod_chip_close(chip);
        chip = NULL;
    }
    sensor_ready = 0;
#endif
}

int get_water_level(void) {
#if SIMULATION_MODE
    static int current_level = WATER_LEVEL_DEFAULT;
    int delta = 0;

    if (!sensor_ready) {
        sensor_init();
    }

    delta = (rand() % ((SENSOR_DRIFT_MAX * 2) + 1)) - SENSOR_DRIFT_MAX;
    current_level += delta;
    current_level = clamp_level(current_level);
    last_known_level = current_level;
    printf("[Sensor] Distance: %.2f cm | Level: %d%%\n", (double)TANK_HEIGHT_CM * (1.0 - (current_level / 100.0)), current_level);
    return current_level;
#else
    struct timespec wait_start;
    struct timespec echo_start;
    struct timespec echo_end;
    int echo_value = 0;
    long pulse_us = 0;
    double distance_cm = 0.0;
    int level = WATER_LEVEL_DEFAULT;

    if (!sensor_ready) {
        sensor_init();
    }

    if (!sensor_ready || trig_line == NULL || echo_line == NULL) {
        return last_known_level;
    }

    (void)gpiod_line_set_value(trig_line, 0);
    usleep(2);
    (void)gpiod_line_set_value(trig_line, 1);
    usleep(TRIGGER_PULSE_US);
    (void)gpiod_line_set_value(trig_line, 0);

    clock_gettime(CLOCK_MONOTONIC, &wait_start);
    do {
        echo_value = gpiod_line_get_value(echo_line);
        if (echo_value < 0) {
            fprintf(stderr, "[Sensor] Failed to read ECHO: %s\n", strerror(errno));
            return last_known_level;
        }
        if (echo_value == 1) {
            break;
        }
        usleep(ECHO_POLL_US);
        clock_gettime(CLOCK_MONOTONIC, &echo_start);
    } while (elapsed_us(&wait_start, &echo_start) < SENSOR_TIMEOUT_US);

    if (echo_value != 1) {
        fprintf(stderr, "[Sensor] Timeout waiting for echo start\n");
        return last_known_level;
    }

    clock_gettime(CLOCK_MONOTONIC, &echo_start);
    do {
        echo_value = gpiod_line_get_value(echo_line);
        if (echo_value < 0) {
            fprintf(stderr, "[Sensor] Failed to read ECHO: %s\n", strerror(errno));
            return last_known_level;
        }
        if (echo_value == 0) {
            break;
        }
        usleep(ECHO_POLL_US);
        clock_gettime(CLOCK_MONOTONIC, &echo_end);
    } while (elapsed_us(&echo_start, &echo_end) < SENSOR_TIMEOUT_US);

    if (echo_value != 0) {
        fprintf(stderr, "[Sensor] Timeout waiting for echo end\n");
        return last_known_level;
    }

    clock_gettime(CLOCK_MONOTONIC, &echo_end);
    pulse_us = elapsed_us(&echo_start, &echo_end);
    distance_cm = (pulse_us / 1000000.0) * SPEED_OF_SOUND_CM_PER_S / 2.0;

    level = (int)((((double)TANK_HEIGHT_CM - distance_cm) / (double)TANK_HEIGHT_CM) * 100.0);
    level = clamp_level(level);
    last_known_level = level;

    printf("[Sensor] Distance: %.2f cm | Level: %d%%\n", distance_cm, level);
    return level;
#endif
}
