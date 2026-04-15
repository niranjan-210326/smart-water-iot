#include "motor.h"

#include <errno.h>
#include <stdio.h>
#include <string.h>

#if !SIMULATION_MODE
#include <gpiod.h>
#endif

#define GPIO_CHIP_NAME "gpiochip0"
#define MOTOR_GPIO_LINE 18

static int motor_state = 0;

#if !SIMULATION_MODE
static struct gpiod_chip *chip = NULL;
static struct gpiod_line *line = NULL;
static int gpio_ready = 0;
#endif

void motor_init(void) {
    motor_state = 0;

#if SIMULATION_MODE
    printf("[INFO] SIMULATION_MODE enabled. GPIO actions are mocked.\n");
    return;
#else
    chip = gpiod_chip_open_by_name(GPIO_CHIP_NAME);
    if (chip == NULL) {
        fprintf(stderr, "[ERROR] Failed to open %s: %s\n", GPIO_CHIP_NAME, strerror(errno));
        gpio_ready = 0;
        return;
    }

    line = gpiod_chip_get_line(chip, MOTOR_GPIO_LINE);
    if (line == NULL) {
        fprintf(stderr, "[ERROR] Failed to get GPIO line %d: %s\n", MOTOR_GPIO_LINE, strerror(errno));
        gpiod_chip_close(chip);
        chip = NULL;
        gpio_ready = 0;
        return;
    }

    if (gpiod_line_request_output(line, "water_system", 0) < 0) {
        fprintf(stderr, "[ERROR] Failed to request GPIO line as output: %s\n", strerror(errno));
        gpiod_chip_close(chip);
        chip = NULL;
        line = NULL;
        gpio_ready = 0;
        return;
    }

    gpio_ready = 1;
    printf("[INFO] GPIO initialized on %s line %d.\n", GPIO_CHIP_NAME, MOTOR_GPIO_LINE);
#endif
}

int get_motor_state(void) {
    return motor_state;
}

void motor_on(void) {
    motor_state = 1;

#if SIMULATION_MODE
    printf("[SIM] Motor ON (GPIO skipped)\n");
    return;
#else
    if (!gpio_ready || line == NULL) {
        fprintf(stderr, "[ERROR] motor_on called before GPIO init\n");
        return;
    }

    if (gpiod_line_set_value(line, 1) < 0) {
        fprintf(stderr, "[ERROR] Failed to set motor ON: %s\n", strerror(errno));
    }
#endif
}

void motor_off(void) {
    motor_state = 0;

#if SIMULATION_MODE
    printf("[SIM] Motor OFF (GPIO skipped)\n");
    return;
#else
    if (!gpio_ready || line == NULL) {
        return;
    }

    if (gpiod_line_set_value(line, 0) < 0) {
        fprintf(stderr, "[ERROR] Failed to set motor OFF: %s\n", strerror(errno));
    }
#endif
}

void motor_cleanup(void) {
#if SIMULATION_MODE
    return;
#else
    if (line != NULL) {
        gpiod_line_release(line);
        line = NULL;
    }
    if (chip != NULL) {
        gpiod_chip_close(chip);
        chip = NULL;
    }
    gpio_ready = 0;
#endif
}
