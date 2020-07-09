#pragma once
#include "Light.h"
#include "OmniShadowMap_FrameBuffer.h"

#include <vector>

class PointLight :
	public Light
{
public:
	PointLight();
	PointLight(GLuint shadowWidth, GLuint shadowHeight,
				GLfloat near, GLfloat far,
				GLfloat red, GLfloat green, GLfloat blue,
				GLfloat xPos, GLfloat yPos, GLfloat zPos);

	void UseLight(GLuint ambientColorLocation,
				  GLuint positionLocation);

	std::vector<glm::mat4> CalculateLightTransform();
	GLfloat GetFarPlane();
	glm::vec3 GetPosition();

	~PointLight();

protected:
	glm::vec3 position;

	GLfloat farPlane{ 0.0f };

};

