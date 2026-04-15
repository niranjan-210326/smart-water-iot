CC = gcc
CFLAGS = -std=c99 -Wall -Wextra -pedantic
LDLIBS = -lgpiod
TARGET = water_system
SOURCES = main.c motor.c sensor.c fault.c utils.c
OBJECTS = $(SOURCES:.c=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ $(OBJECTS) $(LDLIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)
