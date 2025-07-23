#include <Servo.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// Bluetooth serial pins (RX, TX)
// Connect HC-05/HM-10 TX -> Arduino pin 11, RX -> Arduino pin 12 (via voltage divider for HC-05 if using HC-05)

// Motor driver pins (example from testing-motors.cpp)
const int in1 = 10;
const int in2 = 9;
const int in3 = 2;  // motor control
const int in4 = 3;  // motor control
const int in5 = 5;
const int in6 = 6;
const int in7 = 7;
const int in8 = 8;

// All servos now use PCA9685 - no Arduino pin servos
// servo1 uses PCA9685 channel 12, servo4 uses PCA9685 channel 14

// PCA9685 servo driver for all servos
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// Track key states
bool wPressed = false;
bool sPressed = false;
bool aPressed = false;
bool dPressed = false;

// Bluetooth communication variables
String inputString = "";         // Used to store received content
boolean newLineReceived = false; // Previous data end flag
boolean startBit = false;        // Acceptance Agreement Start Sign
int num_receive = 0;

// Convert servo angle to PWM value for PCA9685
int servoAngleToPWM(int angle) {
  // Typical 0° = 150, 180° = 600 (can vary by servo)
  return map(angle, 0, 180, 150, 600);
}

void setupMotorPins() {
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);
  pinMode(in5, OUTPUT);
  pinMode(in6, OUTPUT);
  pinMode(in7, OUTPUT);
  pinMode(in8, OUTPUT);

  stopMotors();
}

void setupServos() {
  // Initialize PCA9685 for all servos
  pwm.begin();
  pwm.setPWMFreq(50); // Standard servo frequency = 50 Hz
  
  // Initialize servos to their starting positions
  pwm.setPWM(12, 0, servoAngleToPWM(23));    // servo 1 on PCA9685 channel 12
  pwm.setPWM(1, 0, servoAngleToPWM(75));     // servo 2 on PCA9685 channel 1
  pwm.setPWM(2, 0, servoAngleToPWM(90));     // servo 3 on PCA9685 channel 2
  pwm.setPWM(14, 0, servoAngleToPWM(90));    // servo 4 on PCA9685 channel 14
  pwm.setPWM(4, 0, servoAngleToPWM(90));     // servo 5 on PCA9685 channel 4
  pwm.setPWM(8, 0, servoAngleToPWM(90));     // servo 6 on PCA9685 channel 8
  
  Serial.println("All servos initialized on PCA9685");
}

void controlServo(int servoNumber, int angle) {
  // Constrain angle to valid range (0-180)
  angle = constrain(angle, 0, 180);
  
  switch (servoNumber) {
    case 1:
      pwm.setPWM(12, 0, servoAngleToPWM(angle)); // channel 12 = 1st servo
      Serial.print("Servo 1 (PCA9685 Ch12) set to: ");
      break;
    case 2:
      pwm.setPWM(1, 0, servoAngleToPWM(angle)); // channel 1 = 2nd servo
      Serial.print("Servo 2 (PCA9685 Ch1) set to: ");
      break;
    case 3:
      pwm.setPWM(2, 0, servoAngleToPWM(angle)); // channel 2 = 3rd servo
      Serial.print("Servo 3 (PCA9685 Ch2) set to: ");
      break;
    case 4:
      pwm.setPWM(14, 0, servoAngleToPWM(angle)); // channel 14 = 4th servo
      Serial.print("Servo 4 (PCA9685 Ch14) set to: ");
      break;
    case 5:
      pwm.setPWM(4, 0, servoAngleToPWM(angle)); // channel 4 = 5th servo
      Serial.print("Servo 5 (PCA9685 Ch4) set to: ");
      break;
    case 6:
      pwm.setPWM(8, 0, servoAngleToPWM(angle)); // channel 8 = 6th servo
      Serial.print("Servo 6 (PCA9685 Ch8) set to: ");
      break;
    default:
      Serial.print("Invalid servo number: ");
      Serial.println(servoNumber);
      return;
  }
  Serial.print(angle);
  Serial.println(" degrees");
}

void forwardMotion() {
  Serial.println("FORWARD MOTION");
  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);
  digitalWrite(in3, HIGH); digitalWrite(in4, LOW);
  digitalWrite(in5, HIGH); digitalWrite(in6, LOW);
  digitalWrite(in7, HIGH); digitalWrite(in8, LOW);
}

void backwardMotion() {
  Serial.println("BACKWARD MOTION");
  digitalWrite(in1, LOW); digitalWrite(in2, HIGH);
  digitalWrite(in3, LOW); digitalWrite(in4, HIGH);
  digitalWrite(in5, LOW); digitalWrite(in6, HIGH);
  digitalWrite(in7, LOW); digitalWrite(in8, HIGH);
}

void rightMotion() {
  Serial.println("RIGHT MOTION");
  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);// left, bottom
  digitalWrite(in5, LOW); digitalWrite(in6, HIGH); // right
  digitalWrite(in3, HIGH); digitalWrite(in4, LOW);
  digitalWrite(in7, LOW); digitalWrite(in8, HIGH);
}

void leftMotion() {
  Serial.println("LEFT MOTION");
  digitalWrite(in1, LOW); digitalWrite(in2, HIGH);
  digitalWrite(in5, HIGH); digitalWrite(in6, LOW);
  digitalWrite(in3, LOW); digitalWrite(in4, HIGH);
  digitalWrite(in7, HIGH); digitalWrite(in8, LOW);
}

void stopMotors() {
  digitalWrite(in1, LOW); digitalWrite(in2, LOW);
  digitalWrite(in3, LOW); digitalWrite(in4, LOW);
  digitalWrite(in5, LOW); digitalWrite(in6, LOW);
  digitalWrite(in7, LOW); digitalWrite(in8, LOW);
}

void updateMotion() {
  // Handle main movement motors (1-4)
  if (wPressed && !sPressed) {
    forwardMotion();
  } else if (sPressed && !wPressed) {
    backwardMotion();
  } else if (aPressed && !dPressed) {
    leftMotion();
  } else if (dPressed && !aPressed) {
    rightMotion();
  } else {
    // Stop main motors if no directional keys pressed
    digitalWrite(in1, LOW); digitalWrite(in2, LOW);
    digitalWrite(in3, LOW); digitalWrite(in4, LOW);
    digitalWrite(in5, LOW); digitalWrite(in6, LOW);
    digitalWrite(in7, LOW); digitalWrite(in8, LOW);
  }
}

void parseCommand(char key, char value) {
  Serial.print("Received command: ");
  Serial.print(key);
  Serial.print(" = ");
  Serial.println(value);
  
  bool pressed = (value == '1');
  switch (key) {
    case 'W': wPressed = pressed; break;
    case 'S': sPressed = pressed; break;
    case 'A': aPressed = pressed; break;
    case 'D': dPressed = pressed; break;
    default: break;
  }
  
  // Update motion immediately when command is received
  updateMotion();
}

void parseServoCommand(String command) {
  // Expected format: %S1:90# (Servo 1 to 90 degrees)
  // Or: %S2:45# (Servo 2 to 45 degrees), etc.
  
  if (command.length() < 5) return; // Minimum: %S1:0#
  
  if (command[1] == 'S') {
    int servoNum = command[2] - '0'; // Convert char to int
    int colonIndex = command.indexOf(':');
    int hashIndex = command.indexOf('#');
    
    if (colonIndex != -1 && hashIndex != -1 && colonIndex < hashIndex) {
      String angleStr = command.substring(colonIndex + 1, hashIndex);
      int angle = angleStr.toInt();
      
      Serial.print("Servo command - Servo: ");
      Serial.print(servoNum);
      Serial.print(", Angle: ");
      Serial.println(angle);
      
      controlServo(servoNum, angle);
    }
  }
}

void setup() {
  Serial.begin(9600);      // USB serial for debugging
  setupMotorPins();
  setupServos();
  Serial.println("Robot ready with servo support");
}

void loop() {
  while (Serial.available()) {
    char incomingByte = Serial.read();
    Serial.print(incomingByte);
    // Check for start marker
    if (incomingByte == '%') {
      num_receive = 0;
      startBit = true;
      inputString = "";
    }
    
    // Add to buffer if we're between markers
    if (startBit) {
      num_receive++;
      inputString += incomingByte;
    }
    
    // Check for end marker
    if (startBit && incomingByte == '#') {
      newLineReceived = true;
      startBit = false;
    }
    
    // Safety check for buffer overflow
    if (num_receive >= 20) {
      num_receive = 0;
      startBit = false;
      newLineReceived = false;
      inputString = "";
    }
  }

  // Process complete command if received
  if (newLineReceived) {
    // Check if this is a servo command
    if (inputString.length() >= 5 && inputString[1] == 'S') {
      parseServoCommand(inputString);
    } else {
      // Handle regular movement commands
      if (inputString.length() >= 3) {
        char key = inputString[1];  // First char after %
        char value;
        
        if (inputString.length() == 3) {
          // Format %KEY# - toggle or sustained press
          value = '1';  // Default to pressed for sustained movement
        } else if (inputString.length() == 4) {
          // Format %KEY1# or %KEY0#
          value = inputString[2];  // Second char after %
        } else {
          value = '1';  // Default fallback
        }
        
        parseCommand(key, value);
      }
    }
    
    // Clear for next command
    inputString = "";
    newLineReceived = false;
  }
}
