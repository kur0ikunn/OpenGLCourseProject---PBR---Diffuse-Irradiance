#include "Model_Shader.h"

void Model_Shader::CompileProgram()
{
	GLint result = 0;
	GLchar eLog[1024] = { 0 };

	glLinkProgram(shaderID);
	glGetProgramiv(shaderID, GL_LINK_STATUS, &result);
	if (!result) {
		glGetProgramInfoLog(shaderID, sizeof(eLog), NULL, eLog);
		printf("Error linking program: '%s'\n", eLog);
		return;
	}

	uniformModel = glGetUniformLocation(shaderID, "Model");
	uniformProjection = glGetUniformLocation(shaderID, "Projection");
	uniformView = glGetUniformLocation(shaderID, "View");
	uniformPrevPVM = glGetUniformLocation(shaderID, "prevPVM");
	uniformDirectionalLight.uniformColor = glGetUniformLocation(shaderID, "directionalLight.base.color");
	uniformDirectionalLight.uniformDirection = glGetUniformLocation(shaderID, "directionalLight.direction");
	uniformEyePosition = glGetUniformLocation(shaderID, "eyePosition");
	uniformHeightScale = glGetUniformLocation(shaderID, "height_scale");
	uniformAlbedo = glGetUniformLocation(shaderID, "material.albedoMap");
	uniformMetallic = glGetUniformLocation(shaderID, "material.metallicMap");
	uniformNormal = glGetUniformLocation(shaderID, "material.normalMap");
	uniformRoughness= glGetUniformLocation(shaderID, "material.roughnessMap");
	uniformParallax = glGetUniformLocation(shaderID, "material.parallaxMap");
	uniformGlow = glGetUniformLocation(shaderID, "material.glowMap");

	uniformPointLightCount = glGetUniformLocation(shaderID, "PointLightCount");

	for (size_t i = 0; i < MAX_POINT_LIGHTS; i++) {

		char locBuff[100] = { '\0' };

		snprintf(locBuff, sizeof(locBuff), "pointLights[%d].base.color", i);
		uniformPointLight[i].uniformColor = glGetUniformLocation(shaderID, locBuff);

		snprintf(locBuff, sizeof(locBuff), "pointLights[%d].position", i);
		uniformPointLight[i].uniformPosition = glGetUniformLocation(shaderID, locBuff);
	}

	uniformSpotLightCount = glGetUniformLocation(shaderID, "SpotLightCount");

	for (size_t i = 0; i < MAX_SPOT_LIGHTS; i++) {

		char locBuff[100] = { '\0' };

		snprintf(locBuff, sizeof(locBuff), "spotLights[%d].base.base.color", i);
		uniformSpotLight[i].uniformColor = glGetUniformLocation(shaderID, locBuff);

		snprintf(locBuff, sizeof(locBuff), "spotLights[%d].base.position", i);
		uniformSpotLight[i].uniformPosition = glGetUniformLocation(shaderID, locBuff);

		snprintf(locBuff, sizeof(locBuff), "spotLights[%d].direction", i);
		uniformSpotLight[i].uniformDirection = glGetUniformLocation(shaderID, locBuff);

		snprintf(locBuff, sizeof(locBuff), "spotLights[%d].edge", i);
		uniformSpotLight[i].uniformEdge = glGetUniformLocation(shaderID, locBuff);
	}
	uniformSkybox = glGetUniformLocation(shaderID, "skybox");
	uniformDirectionalLightTransform = glGetUniformLocation(shaderID, "DirectionalLightTransform");
	uniformDirectionalShadowMap = glGetUniformLocation(shaderID, "DirectionalShadowMap");
	uniformAO = glGetUniformLocation(shaderID, "AOMap");

	uniformOmniLightPos = glGetUniformLocation(shaderID, "lightPos");
	uniformFarPlane = glGetUniformLocation(shaderID, "farPlane");

	for (size_t i = 0; i < 6; i++) {
		char locBuff[100] = { '\0' };

		snprintf(locBuff, sizeof(locBuff), "lightMatrices[%d]", i);
		uniformLightMatrices[i] = glGetUniformLocation(shaderID, locBuff);
	}
	//omnishadowmap
	for (size_t i = 0; i < MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS; i++) {
		char locBuff[100] = { '\0' };

		snprintf(locBuff, sizeof(locBuff), "omniShadowMaps[%d].shadowMap", i);
		uniformOmniShadowMap[i].shadowMap = glGetUniformLocation(shaderID, locBuff);
	}

	for (size_t i = 0; i < MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS; i++) {
		char locBuff[100] = { '\0' };

		snprintf(locBuff, sizeof(locBuff), "omniShadowMaps[%d].farPlane", i);
		uniformOmniShadowMap[i].farPlane = glGetUniformLocation(shaderID, locBuff);
	}
}

void Model_Shader::SetDirectionalLight(DirectionalLight* dLight) {

	dLight->UseLight(uniformDirectionalLight.uniformColor, uniformDirectionalLight.uniformDirection);
}

void Model_Shader::SetPointLight(PointLight* pLight, unsigned int lightCount, unsigned int textureUnit, unsigned int offset) {

	if (lightCount > MAX_POINT_LIGHTS) lightCount = MAX_POINT_LIGHTS;

	glUniform1i(uniformPointLightCount, lightCount);

	for (size_t i = 0; i < lightCount; i++) {																									//pLight is already a pointer 
		pLight[i].UseLight(uniformPointLight[i].uniformColor,									//(pLight+i) = pLight[i]  //*(a+1) = a[i]
			uniformPointLight[i].uniformPosition);

		pLight[i].GetShadowMap()->Read(0, GL_TEXTURE0 + textureUnit + i);
		glUniform1i(uniformOmniShadowMap[i + offset].shadowMap, textureUnit + i);
		glUniform1f(uniformOmniShadowMap[i + offset].farPlane, pLight[i].GetFarPlane());
	}
}

void Model_Shader::SetSpotLight(SpotLight* sLight, unsigned int lightCount, unsigned int textureUnit, unsigned int offset) {

	if (lightCount > MAX_POINT_LIGHTS) lightCount = MAX_SPOT_LIGHTS;

	glUniform1i(uniformSpotLightCount, lightCount);

	for (size_t i = 0; i < lightCount; i++) {																									//sLight is already a pointer 
		sLight[i].UseLight(uniformSpotLight[i].uniformColor,									//(sLight+i) = sLight[i]  //*(a+1) = a[i]
			uniformSpotLight[i].uniformPosition, uniformSpotLight[i].uniformDirection,
			uniformSpotLight[i].uniformEdge);

		sLight[i].GetShadowMap()->Read(0, GL_TEXTURE0 + textureUnit + i);
		glUniform1i(uniformOmniShadowMap[i + offset].shadowMap, textureUnit + i);
		glUniform1f(uniformOmniShadowMap[i + offset].farPlane, sLight[i].GetFarPlane());
	}
}

void Model_Shader::SetSkybox(GLuint textureUnit) {
	glUniform1i(uniformSkybox, textureUnit);
}

void Model_Shader::SetDirectionalShadowMap(GLuint textureUnit)
{
	glUniform1i(uniformDirectionalShadowMap, textureUnit);
}

void Model_Shader::SetAOMap(GLuint textureUnit)
{
	glUniform1i(uniformAO, textureUnit);
}

void Model_Shader::SetDirectionalLightTransform(glm::mat4* lTransform)
{
	glUniformMatrix4fv(uniformDirectionalLightTransform, 1, GL_FALSE, glm::value_ptr(*lTransform));
}

void Model_Shader::SetLightMatrices(std::vector<glm::mat4> lightMatrices)
{
	for (size_t i = 0; i < 6; i++) {

		glUniformMatrix4fv(uniformLightMatrices[i], 1, GL_FALSE, glm::value_ptr(lightMatrices[i]));
	}
}


Model_Shader::~Model_Shader()
{
	ClearShader();
}