pipeline {
    agent any
    stages {
        stage('build') {
            steps {
                sh 'mvn clean install'
                sh '/var/jenkins_home/corona/scanboxwrapper/bin/gammascanner -c ./repository-configuration.json'
            }
        }
    }
}
