#ifndef CONFIG_H
#define CONFIG_H

/* GPIO pin mapping */
#define TRIG_PIN 23
#define ECHO_PIN 24
#define MOTOR_PIN 18

/* Tank calibration */
#define TANK_HEIGHT_CM 100

/* Sensor timing */
#define SENSOR_TIMEOUT_US 30000

/* Runtime mode */
#ifndef SIMULATION_MODE
#define SIMULATION_MODE 1
#endif

#endif /* CONFIG_H */
