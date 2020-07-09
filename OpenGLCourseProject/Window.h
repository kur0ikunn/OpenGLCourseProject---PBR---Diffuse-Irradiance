#pragma once

#include "InputManager.h"

#include <GL/glew.h>
#include <GLFW/glfw3.h>

class Window
{
	friend class InputManager;
public:
	Window();
	Window(GLint windowWidth, GLint windowheight);

	int Initialise();

	bool getShouldClose() { return glfwWindowShouldClose(mainWindow); }

	GLint getBufferWidth() { return bufferWidth; }
	GLint getBufferHeight() { return bufferHeight; }

	bool* getKeys() { return keys; }
	GLfloat getXChange();
	GLfloat getYChange();

	void swapBuffers() { glfwSwapBuffers(mainWindow); }

	~Window();

private:
	GLFWwindow* mainWindow;

	GLint width, height;
	GLint bufferWidth, bufferHeight;

	void createCallbacks();

	bool keys[1024] = {false};

	GLfloat lastX;
	GLfloat lastY;
	GLfloat xChange;
	GLfloat yChange;
	bool mouseFirstMoved = true;
};

